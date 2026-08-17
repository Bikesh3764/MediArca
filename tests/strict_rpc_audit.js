const fs = require('fs');
const path = require('path');

const clientJs = fs.readFileSync(path.join(__dirname, '../js/supabase_client.js'), 'utf8');
const schema = fs.readFileSync(path.join(__dirname, '../supabase_schema.sql'), 'utf8');

console.log('=== STRICT SQL RPC PARAMETER SIGNATURE VALIDATION ===\n');

const rpcRegex = /async\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*\{([\s\S]*?\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*(\{[\s\S]*?\})?\s*\))/g;

let match;
while ((match = rpcRegex.exec(clientJs)) !== null) {
  const methodName = match[1];
  const rpcName = match[4];
  const paramsObjectStr = match[5];

  console.log(`Checking Client Method: ${methodName} -> RPC: ${rpcName}`);
  
  // Find function in SQL
  const funcRegex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${rpcName}\\s*\\((([\\s\\S]*?))\\)\\s*RETURNS`, 'i');
  const funcMatch = schema.match(funcRegex);
  
  if (!funcMatch) {
    console.error(`❌ RPC '${rpcName}' NOT FOUND in SQL schema!`);
    continue;
  }

  const sqlParamsStr = funcMatch[1];
  // Parse SQL parameters: name and type
  const sqlParams = [];
  const sqlParamRegex = /(p_[a-zA-Z0-9_]+)\s+([a-zA-Z0-9_\[\]]+)(\s+DEFAULT\s+[^,\)]+)?/gi;
  let pm;
  while ((pm = sqlParamRegex.exec(sqlParamsStr)) !== null) {
    sqlParams.push({
      name: pm[1],
      type: pm[2],
      hasDefault: !!pm[3]
    });
  }

  // Parse JS passed parameters
  const jsParams = [];
  if (paramsObjectStr) {
    const jsParamRegex = /(p_[a-zA-Z0-9_]+)\s*:/g;
    let jm;
    while ((jm = jsParamRegex.exec(paramsObjectStr)) !== null) {
      jsParams.push(jm[1]);
    }
  }

  console.log(`  SQL Parameters: ${sqlParams.map(p => p.name + (p.hasDefault ? ' (optional)' : ' (REQUIRED)')).join(', ')}`);
  console.log(`  JS Parameters : ${jsParams.join(', ')}`);

  // Check if any JS param is not in SQL
  const invalidJsParams = jsParams.filter(p => !sqlParams.some(sp => sp.name === p));
  if (invalidJsParams.length > 0) {
    console.error(`  🚨 INVALID JS PARAMS (not in SQL signature): ${invalidJsParams.join(', ')}`);
  }

  // Check if any REQUIRED SQL param is missing in JS
  const missingRequiredSqlParams = sqlParams.filter(sp => !sp.hasDefault && !jsParams.includes(sp.name));
  if (missingRequiredSqlParams.length > 0) {
    console.error(`  🚨 MISSING REQUIRED SQL PARAMS: ${missingRequiredSqlParams.map(p => p.name).join(', ')}`);
  }

  if (invalidJsParams.length === 0 && missingRequiredSqlParams.length === 0) {
    console.log(`  ✅ 100% Parameter Signature Match!`);
  }
  console.log('');
}
