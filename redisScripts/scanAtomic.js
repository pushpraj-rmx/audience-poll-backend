const scanScript = `
-- KEYS[1] = duplicateKey
-- KEYS[2] = countKey
-- ARGV[1] = duplicateTTL

local exists = redis.call("SET", KEYS[1], "1", "NX", "EX", ARGV[1])

if not exists then
  return {0, 0}
end

local newCount = redis.call("INCR", KEYS[2])
return {1, newCount}
`;

module.exports = scanScript;