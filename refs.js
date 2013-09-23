var type = require('type')
  , each = require('each')
  , Uri  = require('json-schema-uri')
  , has  = Object.hasOwnProperty

module.exports = References;

function References(obj){
  if (!(this instanceof References)) return new References(obj);
  this._referents = {}; this._referrers = {};
  if (obj) this.parse(obj);
  return this;
}

References.prototype.parse = function(obj){
  this._referents = {}; this._referrers = {};
  traverse({'#': obj}, extract.bind(this));
}

References.prototype.addReferent = function(uri,path){
  this._referents[uri.toString()] = path;
}

References.prototype.addReferrer = function(path,uri){
  this._referrers[path] = uri;
}

References.prototype.getReferent = function(uri){
  return this._referents[uri.toString()];
}

References.prototype.getReferrer = function(path){
  return this._referrers[path];
}

References.prototype.eachReferent = function(fn){
  each(this._referents, fn);
}

References.prototype.eachReferrer = 
References.prototype.each = function(fn){
  each(this._referrers, fn);
}


// private

function extract(obj,key,ctx){
  // console.log("context path, scopes: %s -> %s", ctx.path, ctx.uri.toString());
  if (key == 'id'){
    this.addReferent(ctx.uri, ctx.path);
  }
  var val = obj[key]
  if (!val || !type(val == 'object')) return;
  if (has.call(val,'$ref')){
    this.addReferrer(ctx.childPath, ctx.uri.join(val['$ref']).toString() );
  }
}

// utils

function traverse(obj, ctx, fn){
  if (arguments.length == 2){ 
    fn = ctx; ctx = undefined;
  }
  ctx          = ctx || {};
  ctx.segments = ctx.segments || [];
  ctx.scopes   = ctx.scopes || [ Uri('') ];
  ctx.uri      = ctx.scopes[ctx.scopes.length-1];
  switch(type(obj)){
    case 'array':
    for (var i=0;i<obj.length;++i){
      ctx.path     = ctx.segments.join('/');  // parent path
      ctx.segments.push(i);
      ctx.childPath = ctx.segments.join('/'); 
      fn(obj,i,ctx);
      if (has.call(obj,i)) traverse(obj[i],ctx,fn);
      ctx.segments.pop();
    }
    break;
    
    case 'object':
    if (obj.id){
      ctx.scopes.push( ctx.uri.join(obj.id) );
      ctx.uri = ctx.scopes[ctx.scopes.length-1];
    }
    for (var k in obj){
      if (k == 'enum') continue;
      ctx.path     = ctx.segments.join('/');  // parent path
      ctx.segments.push(k);
      ctx.childPath = ctx.segments.join('/'); 
      fn(obj,k,ctx);
      if (has.call(obj,k)) traverse(obj[k],ctx,fn);
      ctx.segments.pop();
    }
    if (obj.id) {
      ctx.scopes.pop();
      ctx.uri = ctx.scopes[ctx.scopes.length-1];
    }
    break;
  }
}
