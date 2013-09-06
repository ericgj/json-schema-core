var assert = require('timoxley-assert')
  , core = require('json-schema-core')
  , Document = core.Document
  , Schema = core.Schema


fixtures = {};


///////////////////////////////////

describe('json-schema-core', function(){
  describe('parse simple', function(){
    
    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.simple);
    })

    it('should parse', function(){ 
      console.log("subject: %o", this.subject);
    })

    it('should have properties condition', function(){
      var conditions = this.subject;
      assert(conditions.get('properties'));
      assert(conditions.get('properties').nodeType == 'Properties');
    })

    it('should have type condition', function(){
      var conditions = this.subject;
      assert(conditions.get('type'));
      assert(conditions.get('type').nodeType == 'Type');
    })

    it('should have unparsed properties', function(){
      var props = this.subject.properties();
      assert(props.foo);
      assert(props.bar);
    })
    
    it('should store path', function(){
      var conditions = this.subject
      assert('#' == this.subject.path);
    })

    it('should store path for each node', function(){
      var conditions = this.subject
      assert('#/properties' == conditions.get('properties').path);
      assert('#/type' == conditions.get('type').path);
    })

  })

  describe('parse properties', function(){

    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.properties);
    })

    it('should parse', function(){ 
      console.log("subject: %o", this.subject);
    })

    it('should parse each property value as a schema', function(){
      var props = this.subject.get('properties');
      props.each(function(key,val){
        assert(val.nodeType == 'Schema'); 
      })
      assert(props.get('one'));
      assert(props.get('two'));
      assert(props.get('three'));
    })

    it('should store path for each node', function(){
      var props = this.subject.get('properties');
      assert('#/properties' == props.path);
      assert('#/properties/one' == props.get('one').path);
      assert('#/properties/two' == props.get('two').path);
      assert('#/properties/three' == props.get('three').path);
      assert('#/properties/one/type' == props.get('one').get('type').path);
      assert('#/properties/two/type' == props.get('two').get('type').path);
      assert('#/properties/three/type' == props.get('three').get('type').path);
    })

  })

  describe('parse type', function(){

    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.type);
    })

    it('should parse', function(){ 
      console.log("subject: %o", this.subject);
    })

    it('should parse simple type', function(){
      var props = this.subject.get('properties')
        , prop = props.get('simple')
        , type = prop.get('type')
      assert(type.get() == 'string');
      assert(!type.isArray);
    })

    it('should parse multi value type', function(){
      var props = this.subject.get('properties')
        , prop = props.get('multi')
        , type = prop.get('type')
      assert(type.isArray);
      assert(type.has(0));
      assert(type.has('1'));
      assert(type.has('2'));
    })

    it('should store path for each node', function(){
      var props = this.subject.get('properties')
      props.each( function(key,prop){
        assert('#/properties/'+key == prop.path);
        var type = prop.get('type');
        assert('#/properties/'+key+'/type' == type.path);
      })
    })

  })


  // todo: more node types


  describe('search paths', function(){
    
    beforeEach(function(){
      this.document = new Document().parse(fixtures.search.all);
      this.subject = this.document.root;
    })

    it('should find root from document', function(){
      assert(this.document.$('#') === this.subject);
    })

    it('should find root from root', function(){
      assert(this.subject.$('#') === this.subject);
    })

    it('should find root from branch', function(){
      var branch = this.subject.get('definitions').get('one').get('type');
      assert(branch);
      assert(branch.$('#') === this.subject);
    })

    it('should find branch from document', function(){
      var branch = this.subject.get('properties').get('one').get('oneOf').get(1);
      assert(branch);
      assert(this.document.$('#/properties/one/oneOf/1') === branch);
    })

    it('should find branch from root', function(){
      var branch = this.subject.get('properties').get('one').get('oneOf').get(1);
      assert(branch);
      assert(this.subject.$('#/properties/one/oneOf/1') === branch);
    })

    it('should find branch from another branch', function(){
      var branch1 = this.subject.get('definitions').get('two');
      var branch2 = this.subject.get('properties').get('one').get('oneOf').get('1');
      assert(branch1);
      assert(branch2);
      assert(branch1.$('#/properties/one/oneOf/1') === branch2);
      assert(branch2.$('#/definitions/two') === branch1);
    })

    it('should find relative branch from root', function(){
      var branch = this.subject.get('properties').get('one').get('oneOf').get(1);
      assert(branch);
      assert(this.subject.$('properties/one/oneOf/1') === branch);
    })

    it('should find relative branch from another branch', function(){
      var branch1 = this.subject.get('properties').get('one');
      var branch2 = this.subject.get('properties').get('one').get('oneOf').get(1);
      assert(branch1);
      assert(branch2);
      assert(branch1.$('oneOf/1') === branch2);
    })

  })

  describe('dereference paths', function(){

    beforeEach(function(){
      this.document = new Document().parse(fixtures.deref.paths);
      this.subject = this.document.root;
    })

    it('should parse', function(){ 
      console.log("document: %o", this.document);
    })

    it('should dereference back-references', function(){
      var props = this.subject.get('properties')
        , schema = props.get('back')
      assert(schema);
      assert(schema.nodeType == 'Schema');
      assert('string' == schema.get('type').get());
    })

    it('should store forward-references', function(){
      var refs = this.document.referrers;
      assert('#/definitions/string' === refs['#/definitions/forward']);
    })

    it('should dereference forward-references', function(){
      assert(this.document.getPath('#/definitions/string') === 
             this.document.getPath('#/definitions/forward')
            );
    })

  })


})

fixtures.parse = {};
fixtures.parse.simple = {
  type: 'object',
  properties: { },
  foo: { },
  bar: { }
}

fixtures.parse.properties = {
  properties: {
    one: {type: 'string'},
    two: {type: 'numeric'},
    three: {type: 'enum'}
  }
}

fixtures.parse.type = {
  properties: {
    simple: { type: 'string' },
    multi:  { type: ['string', 'numeric', 'enum'] }
  }
}

fixtures.search = {};
fixtures.search.all = {
  definitions: {
    one: { type: ['string','boolean'] },
    two: { }
  },
  properties: {
    one: { oneOf: [ { type: 'string' }, { type: 'boolean' } ] }
  }
}

fixtures.deref = {};
fixtures.deref.paths = {
  definitions: {
    forward: { '$ref': '#/definitions/string'},
    string: { type: 'string' }
  },
  properties: {
    back: {'$ref': '#/definitions/string'},
    self: {'$ref': '#'}
  }
}

  
