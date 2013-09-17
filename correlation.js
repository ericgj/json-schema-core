
module.exports = Correlation;

function Correlation(schema,instance){
  if (!(this instanceof Correlation)) return new Correlation(schema,instance);
  this.schema = schema; this.instance = instance;
  return this;
}

/* 
  This is the tricky thing, since you have to correlate movement down the instance
  with movement down the schema. This really requires validation plugin,
  since you need the semantics of oneOf, anyOf, etc.

  However, here the core can provide a naive implementation that simply 
  walks down the schema.get('properties').

  A validation plugin simply has to provide a `subschema(prop)` binding function
  to deal with resolving multiple potential paths.

*/
  
Correlation.prototype.subschema = function(prop){
  return this.schema.$(['properties',prop].join('/'));
}

Correlation.prototype.get = function(prop){
  if (!(this.schema && this.instance)) return;
  var instance = this.instance[prop]
  if (!instance) return;
  var schema = this.subschema(prop)
  if (!schema) return;
  return schema.bind(instance);
}

Correlation.prototype.$ = function(path){ return this.getPath(path); }

Correlation.prototype.getPath = function(path){
  if (0==path.length) return this;
  var parts = path.split('/')
    , prop = parts.shift()
    , rest = parts.join('/')
  if ('#' == prop) return this.getPath(rest);
  var branch = this.get(prop)
  if (!branch) return;
  return branch.getPath(rest);
}

