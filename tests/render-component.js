const {readFileSync,existsSync}=require('node:fs');
const {join,dirname}=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const React=require('react');
const cache=new Map();
function loadComponent(filename) {
  if(cache.has(filename))return cache.get(filename).exports;
  const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(dirname(filename));cache.set(filename,m);
  m.require=function(id){
    if(id==='lucide-react'){const Icon=()=>React.createElement('svg');return new Proxy({},{get:(_,key)=>key==='__esModule'?true:Icon});}
    if(id.startsWith('.'))for(const ext of ['.tsx','.ts']){const file=join(dirname(filename),id+ext);if(existsSync(file))return loadComponent(file);}
    return Module.prototype.require.call(this,id);
  };
  m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
  return m.exports;
}
module.exports={loadComponent};
