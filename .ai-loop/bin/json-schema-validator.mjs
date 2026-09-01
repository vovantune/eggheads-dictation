const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const supportedKeywords = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "default",
  "type", "required", "properties", "additionalProperties", "enum", "const",
  "minLength", "maxLength", "pattern", "minimum", "maximum",
  "minItems", "maxItems", "uniqueItems", "items", "allOf", "if", "then", "else", "not",
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return object(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function resolveLocalRef(root, reference) {
  if (!reference.startsWith("#/")) throw new Error(`Only local JSON Schema refs are supported: ${reference}`);
  return reference.slice(2).split("/").reduce(
    (value, token) => value?.[token.replaceAll("~1", "/").replaceAll("~0", "~")],
    root,
  );
}

function preflight(schema, root, seen = new WeakSet(), path = "$schema") {
  if (typeof schema === "boolean") return;
  if (!object(schema)) throw new Error(`${path}: schema must be an object or boolean`);
  if (seen.has(schema)) return;
  seen.add(schema);
  const unsupported = Object.keys(schema).find((key) => !supportedKeywords.has(key));
  if (unsupported) throw new Error(`${path}: unsupported schema keyword ${unsupported}`);
  if (schema.$ref !== undefined) {
    if (typeof schema.$ref !== "string" || !schema.$ref.startsWith("#/")) {
      throw new Error(`${path}: only local JSON Schema refs are supported`);
    }
    const target = resolveLocalRef(root, schema.$ref);
    if (target === undefined) throw new Error(`${path}: unresolved ref ${schema.$ref}`);
    preflight(target, root, seen, `${path}.$ref(${schema.$ref})`);
  }
  for (const [name, child] of Object.entries(schema.$defs ?? {})) preflight(child, root, seen, `${path}.$defs.${name}`);
  for (const [name, child] of Object.entries(schema.properties ?? {})) preflight(child, root, seen, `${path}.properties.${name}`);
  for (const key of ["items", "additionalProperties", "if", "then", "else", "not"]) {
    if (schema[key] !== undefined) preflight(schema[key], root, seen, `${path}.${key}`);
  }
  for (const [index, child] of (schema.allOf ?? []).entries()) preflight(child, root, seen, `${path}.allOf[${index}]`);
}

function check(value, schema, root, path, activeRefs) {
  if (schema === true) return null;
  if (schema === false) return `${path}: schema is false`;
  if (!object(schema)) return `${path}: schema must be an object or boolean`;
  if (schema.$ref !== undefined) {
    const target = resolveLocalRef(root, schema.$ref);
    const activeValues = activeRefs.get(target) ?? new Set();
    activeRefs.set(target, activeValues);
    const error = activeValues.has(value) ? null : (() => {
      activeValues.add(value);
      const result = check(value, target, root, path, activeRefs);
      activeValues.delete(value);
      return result;
    })();
    if (error) return error;
  }

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => typeMatches(value, type))) {
    return `${path}: expected type ${types.join("|")}`;
  }
  if (schema.const !== undefined && canonical(value) !== canonical(schema.const)) {
    return `${path}: must equal const ${JSON.stringify(schema.const)}`;
  }
  if (schema.enum && !schema.enum.some((item) => canonical(item) === canonical(value))) {
    return `${path}: value is not in enum`;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) return `${path}: shorter than minLength`;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${path}: longer than maxLength`;
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) return `${path}: does not match pattern`;
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return `${path}: below minimum`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${path}: above maximum`;
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return `${path}: fewer than minItems`;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${path}: more than maxItems`;
    if (schema.uniqueItems && new Set(value.map(canonical)).size !== value.length) return `${path}: items are not unique`;
    if (schema.items !== undefined) {
      for (const [index, item] of value.entries()) {
        const error = check(item, schema.items, root, `${path}[${index}]`, activeRefs);
        if (error) return error;
      }
    }
  }
  if (object(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) return `${path}.${key}: required property is missing`;
    }
    const known = schema.properties ?? {};
    for (const [key, childSchema] of Object.entries(known)) {
      if (Object.hasOwn(value, key)) {
        const error = check(value[key], childSchema, root, `${path}.${key}`, activeRefs);
        if (error) return error;
      }
    }
    for (const key of Object.keys(value).filter((item) => !Object.hasOwn(known, item))) {
      if (schema.additionalProperties === false) return `${path}.${key}: additional property is forbidden`;
      if (object(schema.additionalProperties) || typeof schema.additionalProperties === "boolean") {
        const error = check(value[key], schema.additionalProperties, root, `${path}.${key}`, activeRefs);
        if (error) return error;
      }
    }
  }
  for (const childSchema of schema.allOf ?? []) {
    const error = check(value, childSchema, root, path, activeRefs);
    if (error) return error;
  }
  if (schema.if !== undefined) {
    const conditionMatches = check(value, schema.if, root, path, activeRefs) === null;
    const branch = conditionMatches ? schema.then : schema.else;
    if (branch !== undefined) return check(value, branch, root, path, activeRefs);
  }
  if (schema.not !== undefined && check(value, schema.not, root, path, activeRefs) === null) {
    return `${path}: forbidden by not`;
  }
  return null;
}

export function assertJsonSchema(value, schema, label = "artifact") {
  preflight(schema, schema);
  const error = check(value, schema, schema, "$", new Map());
  if (error) throw new Error(`${label} schema violation: ${error}`);
}
