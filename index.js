var each = require('each')
  , type = require('type')
  , indexOf = require('indexof')

// from component/inherit
function inherit(a,b){
  var fn = function(){}
  fn.prototype = b.prototype;
  a.prototype = new fn;
}

module.exports = {Schema: Schema, Document: Document};


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
Node.prototype.$ = function(key){ return this.get(key); }

// recursive get via path
Node.prototype.getPath = function(path){
  var segs = path.split('/')
    , seg = segs.shift()
    , path = segs.join('/')
  if (0 == seg.length) return this;
  if ('#' == seg) return this.getPath(path); // '#' == this
  if (!this.has(seg)) return; // or throw error ?
  if (0 == path.length){
    return this.$(seg);
  } else {
    return this.$(seg).getPath(path);
  }
}

// utility function called from nodes (within parse)
// note it assumes referents and referrers properties of document object

function dereference(obj,doc){
  if (type(obj)=='array'){
    each(obj, function(it,i){
      dereferenceObject(i,it,obj,doc);
    })
  } else if (type(obj)=='object'){
    each(obj, function(key,it){
      dereferenceObject(key,it,obj,doc);  
    })
  }
}

function dereferenceObject(key,obj,parent,doc){
  if (!isReference(obj)) return;
  var target = obj['$ref']
    , ref = doc.referents[target] || doc.getPath(target)
  if (ref) {
    parent.set(key, ref);
  } else {
    var path = [parent.path, key].join('/')
    doc.referrers[path] = target;
  }
}

function isReference(obj){
  return ("object"==type(obj) && obj['$ref']);
}

//////////////

function Document(uri,service){
  this.referents = {};
  this.referrers = {};
}

Document.prototype.parse = function(obj){
  this.root = new Schema(this);
  this.root.parse(obj);
}

Document.prototype.getPath = function(path){
  if (!this.root) return;
  return this.root.getPath(path);
}


function Schema(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Schema';
}
inherit(Schema,Node);

Schema.prototype.parse = function(obj){
  this._properties = {};
  this._conditions = {};
  dereference(obj,this.document);
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

Schema.prototype.properties = function(){
  return this._properties;
}


// class methods

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


/////////
// inject parse classes 

function base(target){
  target.addType('items',Items);
  target.addType('definitions',Definitions);
  target.addType('properties',Properties);
  target.addType('patternProperties',PatternProperties);
  target.addType('properties',Properties);
  target.addType('dependencies',Dependencies);
  target.addType('type',Type);
  target.addType('allOf',AllOf);
  target.addType('anyOf',AnyOf);
  target.addType('oneOf',OneOf);
  target.addType('not',Not);
}

Schema.use(base);


// base parse classes

function SchemaCollection(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'SchemaCollection';
}
inherit(SchemaCollection,Node);

SchemaCollection.prototype.parse = function(obj){
  this._schemas = {};
  dereference(obj,this.document);
  var self = this;
  each(obj, function(key,val){
    if (isReference(val)) return;
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
}
inherit(SchemaArray,Node);

SchemaArray.prototype.parse = function(obj){
  this._schemas = [];
  dereference(obj,this.document);
  var self = this;
  each(obj, function(val,i){
    if (isReference(val)) return;
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

SchemaArray.prototype.has = function(schema){
  return (~indexOf(this._schemas,schema));
}

SchemaArray.prototype.each = function(fn){
  each(this._schemas, fn);
}

SchemaArray.prototype.addSchema = function(key,val){
  var path = [this.path,key].join('/')
  var schema = new Schema(this.document, path).parse(val);
  this.set(schema);
}


///////
// concrete parse classes

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



function Type(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Type';
}
inherit(Type, Node);

Type.prototype.parse = function(val){
  this._values = [];
  this.isArray = type(val) == 'array';
  var self = this;
  if (this.isArray){
    dereference(val, this.document);
    each(val, function(t,i){
      if (isReference(t)) return;
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

Type.prototype.has = function(val){
  return (~indexOf(this._values,val));
}


function Items(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Items';
}
inherit(Items, Node);

Items.prototype.parse = function(obj){
  this._items = [];
  this.isArray = type(obj) == 'array';
  var self = this;
  if (this.isArray){
    dereference(obj, this.document);
    each(obj, function(s,i){
      if (isReference(s)) return;
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

Items.prototype.has = function(schema){
  return (~indexOf(this._items,schema));
}

Items.prototype.addSchema = function(obj){
  var path = [this.path,this._items.length].join('/');
  var schema = new Schema(this.document,path).parse(obj);
  this.set(schema);
}


function Dependencies(doc,path){
  Node.call(this,doc,path);
  this.nodeType = 'Dependencies';
}
inherit(Dependencies,Node);

Dependencies.prototype.parse = function(obj){
  this._deps = {};
  dereference(obj,this.document);
  var self = this;
  each(obj, function(key,val){
    if (isReference(val)) return;
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
}
inherit(Dependency,Node);

Dependency.prototype.parse = function(obj){
  this._values = [];
  this._schema = undefined;
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

