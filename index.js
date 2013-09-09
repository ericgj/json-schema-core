var each = require('each')
  , type = require('type')
  , indexOf = require('indexof')
  , inherit = require('inherit')
  , has = Object.hasOwnProperty

module.exports = {
  Document: Document,
  Node: Node,
  Schema: Schema,
  SchemaCollection: SchemaCollection,
  SchemaArray: SchemaArray,
  SchemaBoolean: SchemaBoolean
};



///////
// abstract base class

function Node(doc,path){
 this.document = doc || this;
 this.path = path || '#';
 this.nodeType = 'Node';
}
Node.prototype.parse = function(obj){} // subclass parse
Node.prototype.get = function(key){}   // subclass property/element accessor
Node.prototype.has = function(key){}
Node.prototype.set = function(key,val){}  // setter
Node.prototype.each = function(fn){} // iterator

// shortcut
Node.prototype.$ = function(key){ return this.getPath(key); }

// recursive get via (absolute or relative) path
Node.prototype.getPath = function(path){
  var segs = path.split('/')
    , seg = segs.shift()
    , path = segs.join('/')
  if (0 == seg.length) return this;
  if ('#' == seg) return this.document.getPath(path); // '#' == this.document
  if (!this.has(seg)) return; // or throw error ?
  if (0 == path.length){
    return this.get(seg);
  } else {
    return this.get(seg).getPath(path);
  }
}

Node.prototype.dereference = function(obj){
  var parent = this;
  if (type(obj)=='array'){
    each(obj, function(it,i){
      if (isReference(it)) dereferenceObject(parent,i,it['$ref'],parent.document);
    })
  } else if (type(obj)=='object'){
    each(obj, function(key,it){
      if (isReference(it)) dereferenceObject(parent,key,it['$ref'],parent.document);
    })
  }
}

Node.prototype.isReference = isReference;


// utility function called from nodes (within parse)
// note it assumes referents and referrers properties of document object

function dereference(obj,parent,doc){
  if (type(obj)=='array'){
    each(obj, function(it,i){
      if (isReference(it)) dereferenceObject(parent,i,it['$ref'],doc);
    })
  } else if (type(obj)=='object'){
    each(obj, function(key,it){
      if (isReference(it)) dereferenceObject(parent,key,it['$ref'],doc);
    })
  }
}

function dereferenceObject(parent,key,path,doc){
  var ref = doc.referents[path] || doc.getPath(path)
  if (ref) {
    parent.set(key, ref);
  } else {
    var curpath = [parent.path, key].join('/')
    doc.referrers[curpath] = path;
  }
}

function isReference(obj){
  return ("object"==type(obj) && obj['$ref']);
}

///////
// core classes

function Document(uri,service){
  this.referents = {};
  this.referrers = {};
}

Document.prototype.parse = function(obj){
  this.root = new Schema(this);
  this.root.parse(obj);
  this.dereference();
  return this;
}

Document.prototype.$ =
Document.prototype.getPath = function(path){
  if (!this.root) return;
  return this.root.getPath(path);
}

// TODO rethrow error if parent node not found
Document.prototype.dereference = function(){
  var self = this;
  each(this.referrers, function(from,target){
    var ref = self.getPath(target)
    var parts = from.split('/')
      , key = parts.pop()
      , parent = self.getPath(parts.join('/'))
    parent.set(key, ref);
  })
}


function Schema(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Schema';
  this._properties = {};
  this._conditions = {};
}
inherit(Schema,Node);

Schema.prototype.parse = function(obj){
  this.dereference(obj);
  var self = this;
  each(obj, function(key,val){
    if (isReference(val)) return;
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
  var path = [this.path,key].join('/')
  var condition = new klass(this.document, path).parse(val);
  this.set(key,condition);
}

// maybe remove this
Schema.prototype.properties = function(){
  return this._properties;
}

Schema.prototype.property = function(key){
  return this._properties[key];
}

// Schema class methods for extensions

Schema.getType = function(prop){ 
  return this._types[prop];
}

Schema.addType = function(prop,klass){
  this._types[prop] = klass;
}

Schema.use = function(plugin){
  plugin(this);
}

Schema._types = {};


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

function SchemaCollection(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'SchemaCollection';
  this._schemas = {};
}
inherit(SchemaCollection,Node);

SchemaCollection.prototype.parse = function(obj){
  this.dereference(obj);
  var self = this;
  each(obj, function(key,val){
    if (self.isReference(val)) return;
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
  var path = [this.path,key].join('/')
  var schema = new Schema(this.document, path).parse(val);
  this.set(key,schema);
}


function SchemaArray(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'SchemaArray';
  this._schemas = [];
}
inherit(SchemaArray,Node);

SchemaArray.prototype.parse = function(obj){
  this.dereference(obj);
  var self = this;
  each(obj, function(val,i){
    if (self.isReference(val)) return;
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
  each(this._schemas, fn);
}

SchemaArray.prototype.addSchema = function(val){
  var path = [this.path,this._schemas.length].join('/')
  var schema = new Schema(this.document, path).parse(val);
  this.set(schema);
}

function SchemaBoolean(doc,path){
  Node.call(this,doc,path);
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
  this.isBoolean ? fn(this._value) : this._schema.each(fn)
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
  var path = this.path;  // note same path
  var schema = new Schema(this.document,path).parse(obj);
  this.set(schema);
}




///////
// concrete node parse classes

function Definitions(doc,path){ 
  SchemaCollection.call(this,doc,path); 
  this.nodeType = 'Definitions';
}
function Properties(doc,path){
  SchemaCollection.call(this,doc,path); 
  this.nodeType = 'Properties';
}
function PatternProperties(doc,path){
  SchemaCollection.call(this,doc,path); 
  this.nodeType = 'PatternProperties';
}
inherit(Definitions, SchemaCollection);
inherit(Properties, SchemaCollection);
inherit(PatternProperties, SchemaCollection);


function AllOf(doc,path){
  SchemaArray.call(this,doc,path);
  this.nodeType = 'AllOf';
}
function AnyOf(doc,path){
  SchemaArray.call(this,doc,path);
  this.nodeType = 'AnyOf';
}
function OneOf(doc,path){
  SchemaArray.call(this,doc,path);
  this.nodeType = 'OneOf';
}
inherit(AllOf, SchemaArray);
inherit(AnyOf, SchemaArray);
inherit(OneOf, SchemaArray);


function Not(doc,path){
  Schema.call(this,doc,path);
  this.nodeType = 'Not';
}
inherit(Not, Schema);


function AdditionalProperties(doc,path){
  SchemaBoolean.call(this,doc,path);
  this.nodeType = 'AdditionalProperties';
}
function AdditionalItems(doc,path){
  SchemaBoolean.call(this,doc,path);
  this.nodeType = 'AdditionalItems';
}
inherit(AdditionalProperties,SchemaBoolean);
inherit(AdditionalItems,SchemaBoolean);


// custom node classes

function Type(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Type';
  this._values = [];
}
inherit(Type, Node);

Type.prototype.parse = function(val){
  this.isArray = type(val) == 'array';
  var self = this;
  if (this.isArray){
    this.dereference(val);
    each(val, function(t,i){
      if (self.isReference(t)) return;
      self.set(t);
    })
  } else {
    self.set(val);
  }
  return this;
}

Type.prototype.each = function(fn){
  each(this._values,fn);
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


function Items(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Items';
  this._items = [];
}
inherit(Items, Node);

Items.prototype.parse = function(obj){
  this.isArray = type(obj) == 'array';
  var self = this;
  if (this.isArray){
    this.dereference(obj);
    each(obj, function(s,i){
      if (self.isReference(s)) return;
      self.addSchema(s);
    })
  } else {
    self.addSchema(obj);
  }
  return this;
}

Items.prototype.each = function(fn){
  each(this._items,fn);
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
  var path = [this.path,this._items.length].join('/');
  var schema = new Schema(this.document,path).parse(obj);
  this.set(schema);
}



function Dependencies(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Dependencies';
  this._deps = {};
}
inherit(Dependencies,Node);

Dependencies.prototype.parse = function(obj){
  this.dereference(obj);
  var self = this;
  each(obj, function(key,val){
    if (self.isReference(val)) return;
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
  var path = [this.path,key].join('/')
  var dep = new Dependency(this.document, path).parse(val);
  this.set(key,dep);
}


function Dependency(doc,path){
  Node.call(this,doc,path);
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
    var schema = new Schema(doc,path).parse(obj);
    this._schema = schema;
  }
}

Dependency.prototype.each = function(fn){
  if (this.isArray) {
    each(this._values, fn);
  } else {
    fn(this._schema);
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

