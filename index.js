var each = require('each')
  , type = require('type')
  , inherit = require('inherit')
  , Uri = require('json-schema-uri')
  , has = Object.hasOwnProperty

var Correlation = require('./correlation')
  , Refs = require('./refs')

module.exports = {
  Node: Node,
  Schema: Schema,
  SchemaCollection: SchemaCollection,
  SchemaArray: SchemaArray,
  SchemaBoolean: SchemaBoolean,
  Correlation: Correlation,
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
      self._properties[key] = val;
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
  var condition = new klass(this).parse(val);
  this.set(key,condition);
}

Schema.prototype.property = function(key){
  return this._properties[key];
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
  target.addType('type',Type);
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

function SchemaBoolean(parent){
  Node.call(this,parent);
  this.nodeType = 'SchemaBoolean';
  this._schema = undefined;
  this._value = false;
  this.isBoolean = true;
}
inherit(AdditionalItems,Node);

SchemaBoolean.prototype.add = function(obj){
  ("boolean" == typeof obj ? this.addValue(obj) : this.addSchema(obj));
  return this;
}

SchemaBoolean.prototype.each = function(fn){
  if (this.isBoolean){
    fn(undefined, this._value)  // not sure about this
  } else {
    this._schema.each(fn)
  }
}

SchemaBoolean.prototype.get = function(key){
  return (this.isBoolean ? this._value : this._schema.get(key));
}

SchemaBoolean.prototype.set = function(obj){
  this.isBoolean = ("boolean" == typeof obj)
  if (this.isBoolean){
    this._value = obj;
  } else {
    this._schema = obj;
  }
}

SchemaBoolean.prototype.has = function(key){
  return (this.isBoolean ? this._value : this._schema.has(key));
}

SchemaBoolean.prototype.addValue = function(val){
  this.set(!!val);
}

SchemaBoolean.prototype.addSchema = function(obj){
  var schema = new Schema(this).parse(obj);
  this.set(schema);
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
  SchemaBoolean.call(this,parent);
  this.nodeType = 'AdditionalProperties';
}
function AdditionalItems(parent){
  SchemaBoolean.call(this,parent);
  this.nodeType = 'AdditionalItems';
}
inherit(AdditionalProperties,SchemaBoolean);
inherit(AdditionalItems,SchemaBoolean);


// custom node classes

function Type(parent){
  Node.call(this,parent);
  this.nodeType = 'Type';
  this._values = [];
}
inherit(Type, Node);

Type.prototype.parse = function(val){
  this.isArray = type(val) == 'array';
  var self = this;
  if (this.isArray){
    each(val, function(t,i){
      var ref = refOf(val)
      if (ref) { self.addRef(ref,i); return; }
      self.set(t);
    })
  } else {
    self.set(val);
  }
  return this;
}

Type.prototype.each = function(fn){
  each(this._values,function(val,i){ fn(i,val); });
}

Type.prototype.get = function(i){
  i = i || 0;
  return this._values[i];
}

Type.prototype.set = function(val){
  this._values.push(val);
}

Type.prototype.has = function(i){
  return !!this._values[i];
}


function Items(parent){
  Node.call(this,parent);
  this.nodeType = 'Items';
  this._items = [];
}
inherit(Items, Node);

Items.prototype.parse = function(obj){
  this.isArray = type(obj) == 'array';
  var self = this;
  if (this.isArray){
    each(obj, function(s,i){
      var ref = refOf(val)
      if (ref) { self.addRef(ref,i); return; }
      self.addSchema(s);
    })
  } else {
    self.addSchema(obj);
  }
  return this;
}

Items.prototype.each = function(fn){
  each(this._items, function(schema,i){ fn(i,schema); });
}

Items.prototype.get = function(i){
  i = i || 0;
  return this._items[i];
}

Items.prototype.set = function(schema){
  this._items.push(schema);
}

Items.prototype.has = function(i){
  return !!this._items[i];
}

Items.prototype.addSchema = function(obj){
  var schema = new Schema(this).parse(obj);
  this.set(schema);
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


function Dependency(parent){
  Node.call(this,parent);
  this.nodeType = 'Dependency';
  this._values = [];
  this._schema = undefined;
}
inherit(Dependency,Node);

Dependency.prototype.parse = function(obj){
  this.isArray = (type(obj) == 'array');
  if (this.isArray){
    this._values = obj;
  } else {
    var schema = new Schema(doc).parse(obj);
    this._schema = schema;
  }
}

Dependency.prototype.each = function(fn){
  if (this.isArray) {
    each(this._values, function(val,i){ fn(i,val); });
  } else {
    this._schema.each(fn); // not sure about this
  }
}

Dependency.prototype.get = function(i){
  if (this.isArray){
    return this._values[i];
  } else {
    return this._schema;
  }
}

Dependency.prototype.set = function(val){
  if (this.isArray){
    this._values.push(val);
  } else {
    this._schema = val;
  }
}

Dependency.prototype.has = function(val){
  if (this.isArray){
    return has.call(this._values,val);
  } else {
    return (this._schema === val);
  }
}

