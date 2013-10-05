var each = require('each')
  , type = require('type')
  , inherit = require('inherit')
  , Uri = require('json-schema-uri')
  , has = Object.hasOwnProperty

var Refs = require('./refs')
  , Correlation = require('./correlation')

module.exports = {
  Node: Node,
  Schema: Schema,
  SchemaCollection: SchemaCollection,
  SchemaArray: SchemaArray,
  Correlation: Correlation
};



///////
// abstract base class, mostly

function Node(parent){
 this.parent = parent;
 this.nodeType = 'Node';
 this._scope = undefined;
 this._refs = (parent && parent.refs()) || new Refs()
}

Node.prototype.parse = function(obj){} // subclass parse
Node.prototype.get = function(key){}   // subclass property/element accessor
Node.prototype.has = function(key){}
Node.prototype.set = function(key,val){}  // setter
Node.prototype.each = function(fn){} // iterator

Node.prototype.scope = function(id){
  var cur = this._scope || (this.parent && this.parent.scope()); 
  if (arguments.length == 0) {
    return cur; 
  } else {
    var uri = Uri(cur).join(id);
    this._scope = uri.toString();
    this._refs.addScope(this._scope,this);
  }
}

Node.prototype.refs = function(){
  return this._refs;
}

Node.prototype.root = function(){
  if (!this.parent) { return this; }
  else { return this.parent.root(); }
}

Node.prototype.eachRef = function(fn){
  this._refs.each( fn );
}

Node.prototype.addRef = function(ref,key){
  var uri = Uri(this.scope()).join(ref)
  this._refs.add(uri.toString(),this,key);
}

Node.prototype.$ = function(key){ 
  var uri = Uri(this.scope()).join(key)
  var ret = this.getId(uri)
  if (ret) return ret;
  var base = uri.base()
    , fragment = uri.fragment()
  var root = base ? this.getId(base) : this;
  if (!root) return;
  return root.getPath(fragment); 
}

Node.prototype.getId = function(uri){
  return this._refs.getScope(uri.toString());
}

// recursive get via (absolute or relative) path
Node.prototype.getPath = function(path){
  var segs = path.split('/')
    , seg = segs.shift()
    , path = segs.join('/')
  if (0 == seg.length && 0 == segs.length) return this;
  if ('#' == seg) return this.root().getPath(path); 
  if (!this.has(seg)) return; // or throw error ?
  if (0 == path.length){
    return this.get(seg);
  } else {
    return this.get(seg).getPath(path);
  }
}

function refOf(obj){
  return ("object"==type(obj) && obj['$ref']);
}

///////
// core classes


function Schema(parent){
  Node.call(this,parent);
  this.nodeType = 'Schema';
  this._properties = {};
  this._conditions = {};
}
inherit(Schema,Node);

Schema.prototype.parse = function(obj){
  if (has.call(obj,'id')) this.scope(obj.id);
  var self = this;
  each(obj, function(key,val){
    if (val == 'id') return;
    var ref = refOf(val)
    if (ref) { self.addRef(ref,key); return; }
    var klass = Schema.getType(key);
    if (klass){
      self.addCondition(key,val,klass);
    } else {
      self.addProperty(key,val);
    }
  }) 
  return this;
}

Schema.prototype.get = function(key){
  return this._conditions[key];
}

Schema.prototype.set = function(key,cond){
  this._conditions[key] = cond;
}

Schema.prototype.has = function(key){
  return has.call(this._conditions,key);
}

Schema.prototype.each = function(fn){
  each(this._conditions, fn);
}

Schema.prototype.addCondition = function(key,val,klass){
  var parsed = new klass(this).parse(val);
  if (parsed instanceof Node){
    this.set(key,parsed);
  } else {
    this.addProperty(key,parsed);
  }
}

Schema.prototype.addProperty = function(key,val){
  this._properties[key] = val;
}

Schema.prototype.getProperty = 
Schema.prototype.property = function(key){
  return this._properties[key];
}

Schema.prototype.hasProperty = function(key){
  return has.call(this._properties,key);
}

Schema.prototype.eachProperty = function(fn){
  each(this._properties, fn);
}

// mix in each binding method into a Correlation object
Schema.prototype.bind = function(instance){
  var ret = new Correlation(this,instance);
  for (var key in Schema._bindings){
    var fn = Schema._bindings[key];
    ret[key] = fn.bind(ret);
  }
  return ret;
}

// Schema class methods

Schema.union = 
Schema.allOf = function(schemas){
  var schema = new Schema()
  schema.addCondition('allOf',[],AllOf);
  var allOf = schema.get('allOf');
  for (var i=0;i<schemas.length;++i){
    allOf.set(schemas[i]);
  }
  return schema;
}

Schema.getType = function(prop){ 
  return this._types[prop];
}

Schema.addType = function(prop,klass){
  this._types[prop] = klass;
}

Schema.addBinding = function(key, fn){
  this._bindings[key] = fn;
}

Schema.use = function(plugin){
  plugin(this);
}

Schema._types = {};
Schema._bindings = {};

///////
// inject node parse classes by default

function base(target){
  target.addType('items',Items);
  target.addType('additionalItems',AdditionalItems);
  target.addType('definitions',Definitions);
  target.addType('properties',Properties);
  target.addType('patternProperties',PatternProperties);
  target.addType('additionalProperties',AdditionalProperties);
  target.addType('dependencies',Dependencies);
  // target.addType('type',Type);
  target.addType('allOf',AllOf);
  target.addType('anyOf',AnyOf);
  target.addType('oneOf',OneOf);
  target.addType('not',Not);
}

Schema.use(base);


///////
// base node parse classes

function SchemaCollection(parent){
  Node.call(this,parent);
  this.nodeType = 'SchemaCollection';
  this._schemas = {};
}
inherit(SchemaCollection,Node);

SchemaCollection.prototype.parse = function(obj){
  var self = this;
  each(obj, function(key,val){
    var ref = refOf(val)
    if (ref) { self.addRef(ref,key); return; }
    self.addSchema(key,val);
  })
  return this;
}

SchemaCollection.prototype.get = function(key){
  return this._schemas[key];
}

SchemaCollection.prototype.set = function(key,schema){
  this._schemas[key] = schema;
}

SchemaCollection.prototype.has = function(key){
  return has.call(this._schemas,key);
}

SchemaCollection.prototype.each = function(fn){
  each(this._schemas, fn);
}

SchemaCollection.prototype.addSchema = function(key,val){
  var schema = new Schema(this).parse(val);
  this.set(key,schema);
}


function SchemaArray(parent){
  Node.call(this,parent);
  this.nodeType = 'SchemaArray';
  this._schemas = [];
}
inherit(SchemaArray,Node);

SchemaArray.prototype.parse = function(obj){
  var self = this;
  each(obj, function(val,i){
    var ref = refOf(val)
    if (ref) { self.addRef(ref,i); return; }
    self.addSchema(val);
  })
  return this;
}

SchemaArray.prototype.get = function(i){
  return this._schemas[i];
}

SchemaArray.prototype.set = function(schema){
  this._schemas.push(schema);
}

SchemaArray.prototype.has = function(i){
  return !!this.get(i);
}

SchemaArray.prototype.each = function(fn){
  each(this._schemas, function(obj,i){ fn(i,obj); });
}

SchemaArray.prototype.addSchema = function(val){
  var schema = new Schema(this).parse(val);
  this.set(schema);
}


function SchemaOrBoolean(parent){
  if (!(this instanceof SchemaOrBoolean)) return new SchemaOrBoolean(parent);
  this.parent = parent;
  return this;
}

SchemaOrBoolean.prototype.parse = function(obj){
  return (type(obj) == 'boolean' ? obj
                                 : new Schema(this.parent).parse(obj)
         );
}


///////
// concrete node parse classes

function Definitions(parent){ 
  SchemaCollection.call(this,parent); 
  this.nodeType = 'Definitions';
}
function Properties(parent){
  SchemaCollection.call(this,parent); 
  this.nodeType = 'Properties';
}
function PatternProperties(parent){
  SchemaCollection.call(this,parent); 
  this.nodeType = 'PatternProperties';
}
inherit(Definitions, SchemaCollection);
inherit(Properties, SchemaCollection);
inherit(PatternProperties, SchemaCollection);


function AllOf(parent){
  SchemaArray.call(this,parent);
  this.nodeType = 'AllOf';
}
function AnyOf(parent){
  SchemaArray.call(this,parent);
  this.nodeType = 'AnyOf';
}
function OneOf(parent){
  SchemaArray.call(this,parent);
  this.nodeType = 'OneOf';
}
inherit(AllOf, SchemaArray);
inherit(AnyOf, SchemaArray);
inherit(OneOf, SchemaArray);


function Not(parent){
  Schema.call(this,parent);
  this.nodeType = 'Not';
}
inherit(Not, Schema);


function AdditionalProperties(parent){
  SchemaOrBoolean.call(this,parent);
}
function AdditionalItems(parent){
  SchemaOrBoolean.call(this,parent);
}
inherit(AdditionalProperties,SchemaOrBoolean);
inherit(AdditionalItems,SchemaOrBoolean);


// custom node classes

function Items(parent){
  if (!(this instanceof Items)) return new Items(parent);
  this.parent = parent;
  return this;
}

Items.prototype.parse = function(obj){
  return (type(obj) == 'array' ? new SchemaArray(this.parent).parse(obj)
                               : new Schema(this.parent).parse(obj)
         );
}


function Dependencies(parent){
  Node.call(this,parent);
  this.nodeType = 'Dependencies';
  this._deps = {};
}
inherit(Dependencies,Node);

Dependencies.prototype.parse = function(obj){
  var self = this;
  each(obj, function(key,val){
    var ref = refOf(val)
    if (ref) { self.addRef(ref,key); return; }
    self.addDependency(key,val);
  })
  return this;
}

Dependencies.prototype.get = function(key){
  return this._deps[key];
}

Dependencies.prototype.set = function(key,schema){
  this._deps[key] = schema;
}

Dependencies.prototype.has = function(key){
  return has.call(this._deps,key);
}

Dependencies.prototype.each = function(fn){
  each(this._deps, fn);
}

Dependencies.prototype.addDependency = function(key,val){
  var dep = new Dependency(this).parse(val);
  this.set(key,dep);
}

Dependencies.prototype.eachSchemaDependency = function(fn){
  each(this._deps, function(key,dep){
    if (dep instanceof Schema) fn(key,dep);
  })
}

Dependencies.prototype.eachPropertyDependency = function(fn){
  each(this._deps, function(key,dep){
    if (type(dep) == 'array') fn(key,dep);
  })
}


function Dependency(parent){
  if (!(this instanceof Dependency)) return new Dependency(parent);
  this.parent = parent;
  return this;
}

Dependency.prototype.parse = function(obj){
  return (type(obj) == 'array'  ? obj
                                : new Schema(this.parent).parse(obj)
         );
}


