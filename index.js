var each = require('each')
  , type = require('type')

// from component/inherit
function inherit(a,b){
  var fn = function(){}
  fn.prototype = b.prototype;
  a.prototype = new fn;
}

module.exports = Schema;

function Schema(obj,doc,path){
  if (!(this instanceof Schema)) return new Schema(obj,doc);
  this.document = doc || this;
  this.path = path || '#';
  this.$ = {};
  this.properties = {};
  for (var key in obj){
    var klass = Schema.getType(key);
    if (klass){
      this.addCondition(key,obj[key],klass);
    } else {
      this.addProperty(key,obj[key]);
    }
  }
  return this;
}

Schema.prototype.addCondition = function(key,obj,klass){
  var path = [this.path,key].join('/')
  var condition = new klass(obj, this.document, path);
  this.$[key] = condition;
}

Schema.prototype.addProperty = function(key,obj){
  this.properties[key] = obj;
}

Schema.prototype.each = 
Schema.prototype.eachCondition = function(fn){
  each(this.$, fn);
}

Schema.prototype.eachProperty = function(fn){
  each(this.properties, fn);
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

function SchemaCollection(obj,doc,path){
  this.document = doc;
  this.path = path;
  this._properties = {};
  for (var key in obj){
    var path = [this.path,key].join('/');
    var schema = new Schema(obj[key],doc,path);
    this._properties[key] = schema;
  }
}

SchemaCollection.prototype.each =  function(fn){
  each(this._properties, fn);
}

SchemaCollection.prototype.get = function(key){
  return this._properties[key];
}


function SchemaArray(obj,doc,path){
  this.document = doc;
  this.path = path;
  this._items = [];
  for (var i=0;i<obj.length;++i){
    var path = [this.path,i].join('/');
    var schema = new Schema(obj[i],doc,path);
    this._items.push(schema);
  }
}

SchemaArray.prototype.each = function(fn){
  each(this._items,fn);
}

SchemaArray.prototype.items = function(){
  return this._items;
}



// concrete parse classes

function Definitions(obj,doc,path){ 
  SchemaCollection.call(this,obj,doc,path); 
}
function Properties(obj,doc,path){
  SchemaCollection.call(this,obj,doc,path); 
}
function PatternProperties(obj,doc,path){
  SchemaCollection.call(this,obj,doc,path); 
}

inherit(Definitions, SchemaCollection);
inherit(Properties, SchemaCollection);
inherit(PatternProperties, SchemaCollection);


function AllOf(obj,doc,path){
  SchemaArray.call(this,obj,doc,path);
}
function AnyOf(obj,doc,path){
  SchemaArray.call(this,obj,doc,path);
}
function OneOf(obj,doc,path){
  SchemaArray.call(this,obj,doc,path);
}

inherit(AllOf, SchemaArray);
inherit(AnyOf, SchemaArray);
inherit(OneOf, SchemaArray);


function Not(obj,doc,path){
  Schema.call(this,obj,doc,path);
}

inherit(Not, Schema);


function Type(val,doc,path){
  this.document = doc;
  this.path = path;
  this._isArray = type(val) == 'array';
  this._values = (this._isArray ? val : [val]);
}

Type.prototype.isArray = function(){ return this._isArray; }

Type.prototype.each = function(fn){
  each(this._values,fn);
}

Type.prototype.value = function(fn){
  if (this._isArray) return;
  return this._values[0];
}

Type.prototype.values = function(fn){
  if (!this._isArray) return;
  return this._values;
}


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


