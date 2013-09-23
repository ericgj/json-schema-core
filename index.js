var each = require('each')
  , type = require('type')
  , inherit = require('inherit')
  , Emitter = require('emitter')
  , has = Object.hasOwnProperty

var Correlation = require('./correlation')
  , References = require('./refs')

module.exports = {
  Document: Document,
  Node: Node,
  Schema: Schema,
  SchemaCollection: SchemaCollection,
  SchemaArray: SchemaArray,
  SchemaBoolean: SchemaBoolean,
  Correlation: Correlation
};



///////
// abstract base class

function Node(doc){
 this.document = doc || this;
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

Node.prototype.isReference = function(obj){
  return ("object"==type(obj) && obj['$ref']);
}

///////
// core classes

function Document(agent){
  this.agent = agent;
  this._root = undefined;
  this._refs = undefined; 
}

Document.prototype = new Emitter();

Document.prototype.root = function(){
  return this._root;
}

Document.prototype.parse = function(obj){
  this._refs = new References(obj);
  this._root = new Schema(this);
  this._root.parse(obj);
  return this;
}

Document.prototype.$ =
Document.prototype.fragment = function(key){
  return this.getId(key) || this.getPath(key.toString());
}

// note id should be a canonical uri (object or string)
Document.prototype.getId   = function(id){
  var refs = this._refs;
  if (!refs) return;
  var path = refs.getReferent(id);
  if (!path) return;
  return this.getPath(path);
}

Document.prototype.getPath = function(path){
  var root = this.root();
  if (!root) return;
  return root.getPath(path);
}

Document.prototype.dereference = function(fn){
  var refs = this._refs
    , self = this
  if (!refs) return;
  if (fn) this.once('ready', fn);
  var remotes = []
  refs.eachReferrer( function(from,target){
    inlineDereference.call(self,from,target) || 
      remotes.push([from,target]);
  })
  if (remotes.length == 0) {
    self.emit('ready');
  } else {
    while (remotes.length){
      var next = remotes.shift()
      next.push(remotes.length == 0);
      asyncDereference.apply(self,next);
    }
  }
}

function asyncDereference(from,uri,last){
  var self = this, agent = this.agent
  agent.get(uri, function(err,obj){
    if (err){
      self.emit('error', err);
      return;
    }

    setPath.call(self,from,obj);
    if (last) self.emit('ready');

  })

    /* do this within agent.get() 
      var doc = new Document(agent).parse(raw);
      doc.once('ready', function(){
        var obj = fragment ? doc.$(fragment) : doc.root();
        fn(undefined,obj,raw);
      })
      doc.dereference();
    */
}

//TODO rethrow error if parent not found?
function setPath(path,ref){
  var parts = path.split('/')
    , key = parts.pop()
    , parent = this.getPath(parts.join('/'))
  parent && parent.set(key,ref);
}

function inlineDereference(from,target,doc){
  doc = doc || this;
  var ref = this.$(target)  // try inline dereference by URI or JSON pointer 
  if (ref) setPath.call(this,from,ref);
  return (!!ref);
}



function Schema(doc){
  Node.call(this,doc);
  this.nodeType = 'Schema';
  this._properties = {};
  this._conditions = {};
}
inherit(Schema,Node);

Schema.prototype.parse = function(obj){
  var self = this;
  each(obj, function(key,val){
    if (self.isReference(val)) return;
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
  var condition = new klass(this.document).parse(val);
  this.set(key,condition);
}

Schema.prototype.property = function(key){
  return this._properties[key];
}

Schema.prototype.allOf = function(){
  var schemas = [].slice.call(arguments,0);
  if (!this.get('allOf')) this.addCondition('allOf',[],AllOf);
  var allof = this.get('allOf')
  for (var i=0;i<schemas.length;++i) allof.set(schemas[i]);
  return this;
}

Schema.prototype.union = function(){
  var schemas = [].slice.call(arguments,0);
  schemas.unshift(this);
  var schema = new Schema(); // not bound to document
  schema.allOf.apply(schema,schemas);
  return schema;
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

Schema.allOf = function(){
  var args = [].slice.call(arguments,0)
  var s = new Schema()
  return s.allOf.apply(s,args);
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

function SchemaCollection(doc){
  Node.call(this,doc);
  this.nodeType = 'SchemaCollection';
  this._schemas = {};
}
inherit(SchemaCollection,Node);

SchemaCollection.prototype.parse = function(obj){
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
  var schema = new Schema(this.document).parse(val);
  this.set(key,schema);
}


function SchemaArray(doc){
  Node.call(this,doc);
  this.nodeType = 'SchemaArray';
  this._schemas = [];
}
inherit(SchemaArray,Node);

SchemaArray.prototype.parse = function(obj){
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
  each(this._schemas, function(obj,i){ fn(i,obj); });
}

SchemaArray.prototype.addSchema = function(val){
  var schema = new Schema(this.document).parse(val);
  this.set(schema);
}

function SchemaBoolean(doc){
  Node.call(this,doc);
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
  var schema = new Schema(this.document).parse(obj);
  this.set(schema);
}




///////
// concrete node parse classes

function Definitions(doc){ 
  SchemaCollection.call(this,doc); 
  this.nodeType = 'Definitions';
}
function Properties(doc){
  SchemaCollection.call(this,doc); 
  this.nodeType = 'Properties';
}
function PatternProperties(doc){
  SchemaCollection.call(this,doc); 
  this.nodeType = 'PatternProperties';
}
inherit(Definitions, SchemaCollection);
inherit(Properties, SchemaCollection);
inherit(PatternProperties, SchemaCollection);


function AllOf(doc){
  SchemaArray.call(this,doc);
  this.nodeType = 'AllOf';
}
function AnyOf(doc){
  SchemaArray.call(this,doc);
  this.nodeType = 'AnyOf';
}
function OneOf(doc){
  SchemaArray.call(this,doc);
  this.nodeType = 'OneOf';
}
inherit(AllOf, SchemaArray);
inherit(AnyOf, SchemaArray);
inherit(OneOf, SchemaArray);


function Not(doc){
  Schema.call(this,doc);
  this.nodeType = 'Not';
}
inherit(Not, Schema);


function AdditionalProperties(doc){
  SchemaBoolean.call(this,doc);
  this.nodeType = 'AdditionalProperties';
}
function AdditionalItems(doc){
  SchemaBoolean.call(this,doc);
  this.nodeType = 'AdditionalItems';
}
inherit(AdditionalProperties,SchemaBoolean);
inherit(AdditionalItems,SchemaBoolean);


// custom node classes

function Type(doc){
  Node.call(this,doc);
  this.nodeType = 'Type';
  this._values = [];
}
inherit(Type, Node);

Type.prototype.parse = function(val){
  this.isArray = type(val) == 'array';
  var self = this;
  if (this.isArray){
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


function Items(doc){
  Node.call(this,doc);
  this.nodeType = 'Items';
  this._items = [];
}
inherit(Items, Node);

Items.prototype.parse = function(obj){
  this.isArray = type(obj) == 'array';
  var self = this;
  if (this.isArray){
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
  var schema = new Schema(this.document).parse(obj);
  this.set(schema);
}



function Dependencies(doc){
  Node.call(this,doc);
  this.nodeType = 'Dependencies';
  this._deps = {};
}
inherit(Dependencies,Node);

Dependencies.prototype.parse = function(obj){
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
  var dep = new Dependency(this.document).parse(val);
  this.set(key,dep);
}


function Dependency(doc){
  Node.call(this,doc);
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

