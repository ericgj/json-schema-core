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






// inject parse classes 

function base(target){
  // target.addType('items',Items);
  target.addType('definitions',Definitions);
  target.addType('properties',Properties);
  target.addType('patternProperties',PatternProperties);
  target.addType('properties',Properties);
  // target.addType('dependencies',Dependencies);
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



/* TODO

function Items(obj,doc,path){
  this.document = doc;
  this.path = path;
  this._isArray = type(obj) == 'array';
  var items = (this._isArray ? obj : [obj]);
  this._items = [];
  for (var i=0;i<items.length;++i){
    var path = [this.path,i].join('/');
    var schema = new Schema(obj[i],doc,path);
    this._items.push(schema);
  }
}

Items.prototype.isArray = function(){ return this._isArray; }

Items.prototype.eachSchema = 
Items.prototype.each = function(fn){
  each(this._items,fn);
}

Items.prototype.schema = function(){
  if (this._isArray) return; // undefined if array of schemas
  return this._items[0];
}

Items.prototype.schemas = function(){
  if (!this._isArray) return;  // undefined if single schema
  return this._items;
}


function Dependencies(obj,doc,path){
  this.document = doc;
  this.path = path;
  this._properties = {};
  for (var prop in obj){
    var path = [this.path,key].join('/');
    var dep = new Dependency(obj[key],doc,path);
    this._properties[key] = dep;
  }
}

Dependencies.prototype.each =  function(fn){
  each(this._properties, fn);
}

Dependencies.prototype.get = function(key){
  return this._properties[key];
}

function Dependency(obj,doc,path){
  this.document = doc;
  this.path = path;
  this._isArray = (type(obj) == 'array');
  if (this._isArray){
    this._values = obj;
  } else {
    var schema = new Schema(obj,doc,path);
    this._item = schema;
  }
}

Dependency.prototype.isArray = function(){ return this._isArray; }
Dependency.prototype.isSchema = function(){ return !this._isArray; }

Dependency.prototype.eachValue =
Dependency.prototype.each = function(fn){
  if (!this._isArray) return;
  each(this._values,fn);
}

Dependency.prototype.schema = function(){
  if (this._isArray) return;
  return this._item;
}

Dependency.prototype.values = function(){
  if (!this._isArray) return;
  return this._values;
}


*/

