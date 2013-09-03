var each = require('each')
  , type = require('type')

module.exports = Schema;

function Schema(obj,doc){
  if (!(this instanceof Schema)) return new Schema(obj,doc);
  this.document = doc || this;
  this.$ = {};
  this.additionalProperties = {};
  for (var key in obj){
    var klass = Schema.getType(key);
    if (klass){
      this.addCondition(key,obj[key],klass);
    } else {
      this.addAdditionalProperty(key,obj[key]);
    }
  }
  return this;
}

Schema.prototype.addCondition = function(key,obj,klass){
  var condition = new klass(obj, this.document);
  this.$[key] = condition;
}

Schema.prototype.addAdditionalProperty = function(key,obj){
  this.additionalProperties[key] = obj;
}

Schema.prototype.each = 
Schema.prototype.eachCondition = function(fn){
  each(this.$, fn);
}

Schema.prototype.eachAdditionalProperty = function(fn){
  each(this.additionalProperties, fn);
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


// base parse classes 

function base(target){
  target.addType('properties',Properties);
  target.addType('type',Type);
}

Schema.use(base);


function Properties(obj,doc){
  if (!(this instanceof Properties)) return new Properties(obj,doc);
  this.document = doc;
  this._properties = {};
  for (var key in obj){
    var schema = new Schema(obj[key],doc);
    this._properties[key] = schema;
  }
  return this;
}

Properties.prototype.each =  function(fn){
  each(this._properties, fn);
}

Properties.prototype.get = function(key){
  return this._properties[key];
}


function Type(val,doc){
  if (!(this instanceof Type)) return new Type(val,doc);
  this.document = doc;
  this._isArray = type(val) == 'array';
  this._values = (this._isArray ? val : [val]);
  return this;
}

Type.prototype.isArray = function(){ return this._isArray; }

Type.prototype.each = function(fn){
  each(this._values,fn);
}

Type.prototype.value = function(fn){
  return this._isArray ? this._values : this._values[0];
}

Type.prototype.values = function(fn){
  return this._values;
}

