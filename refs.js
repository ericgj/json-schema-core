'use strict';

var Emitter = require('emitter')
  , Uri  = require('json-schema-uri')
  , has  = Object.hasOwnProperty

module.exports = Refs;

function Refs(agent){
  if (!(this instanceof Refs)) return new Refs(agent);
  this.agent = agent;
  this._refs = {}; this._scopes = {};
  return this;
}

Refs.prototype = new Emitter();

Refs.prototype.add = 
Refs.prototype.addRef = function(uri,node,key){
  this._refs[uri.toString()] = [node,key];
}

Refs.prototype.each = 
Refs.prototype.eachRef = function(fn){
  each(this._refs, function(uri,pair){ fn(uri,pair[0],pair[1]); })
}

Refs.prototype.addScope = function(uri,node){
  this._scopes[uri.toString()] = node;
}

Refs.prototype.getScope = function(uri){
  return this._scopes[uri.toString()];
}

Refs.prototype.dereference = function(node,fn,remotes){
  var self = this
  remotes = remotes || [];

  if (fn){
    this.once('ready', fn);
    this.once('error', fn);
  }
  
  this.each( function(uri,node,key){
    inlineDereference.call(self,uri,node,key) ||
      remotes.push([uri,node,key]);
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

// private 

function inlineDereference(uri,node,key){
  var root = node.root()
    , ref = root.$(uri)  // try inline dereference by URI or JSON pointer 
  if (ref) node.set(key,ref);
  return (!!ref);
}

function asyncDereference(uri,node,key){
  var self = this, agent = this.agent
  agent.getCache(uri, function(err,ref){
    if (err){
      self.emit('error', err);
      return;
    }

    node.set(key,ref);
    if (last) self.emit('ready');

  })
}


