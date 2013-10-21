'use strict';
var type = require('type')

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
  walks down the schema.get('properties') or schema.get('items').

  A validation plugin simply has to provide a `subschema(prop)` binding function
  to deal with resolving multiple potential paths.

*/
  
Correlation.prototype.subschema = function(prop){
  var schema = this.schema
    , items = schema.get('items')
  if (items) {
    if (items.nodeType == 'SchemaArray'){
      return items.get(prop); 
    } else {
      return items;
    }
  }
  var props = schema.get('properties') 
  if (!props) return;
  return props.get(prop);
}

/*
 * Coerce (copy of) instance to schema type and apply any default
 * 'Apply default' == 
 *    Merge in defaults if type = 'object', otherwise set default
 *    value if instance is undefined.
 *
 * @returns new Correlation
 *
 */
Correlation.prototype.coerce = function(){
  if (!this.schema) return;
  var schema = this.schema
    , schemaType = schema.property('type')
    , instance = coerceType(this.instance,schemaType);
  if (schema.hasProperty('default')){
    var def = JSON.parse(JSON.stringify(
                schema.property('default')
              ));
    instance = mergeDefault(instance,def);
  }
  return schema.bind(instance);
}


/////////////// TODO: Deprecate these? 
// Traversal through the instance should be done through links

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

////////////////


// utils

// Note: always returns copy
function coerceType(instance,t){
  var actual = type(instance)
    , ret
  t = t || actual; // if type not specified, use actual
  if (t == actual && t !== 'undefined') return JSON.parse(JSON.stringify(instance));
  switch(t){
    case 'array':
    ret = (instance === undefined ? [] : [JSON.parse(JSON.stringify(instance))] );
    break;

    case 'boolean':
    ret = !!instance;
    break;

    case 'integer':
    ret = parseInt(instance);
    break;

    case 'null':
    ret = null;
    break;

    case 'number':
    ret = ((instance/1 % 1) == 0) ? parseInt(instance) : parseFloat(instance);
    break;

    case 'object':
    ret = {}; // note does not attempt to coerce array (or anything else) into object
    break;

    case 'string':
    ret = ( instance === undefined ? "" : instance.toString() );
    break;

    default:
    ret = undefined;
    break;
  }
  return ret;
}

function mergeDefault(instance,def){
  var t = type(def)
    , ret
  instance = coerceType(instance,t);
  if (t == 'object'){
    for (var p in def) instance[p] = instance[p] || def[p];
    ret = instance;
  } else {
    ret = (instance === undefined) ? def : instance;
  }
  return ret;
}

