var assert = require('timoxley-assert')
  , core = require('json-schema-core')
  , Schema = core.Schema
  , Refs = core.Refs

fixtures = {};

Schema.addBinding('nodeTypeAt', nodeTypeAt);


// stupid binding function for testing
function nodeTypeAt(path){
  var target = this.schema.$(path)
  return target && target.nodeType;
}

///////////////////////////////////

describe('json-schema-core', function(){
  describe('parse simple', function(){
    
    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.simple);
    })

    it('should parse', function(){ 
      console.log("subject simple: %o", this.subject);
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
      assert(this.subject.property('foo'));
      assert(this.subject.property('bar'));
    })
    
  })

  describe('parse properties', function(){

    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.properties);
    })

    it('should parse', function(){ 
      console.log("subject properties: %o", this.subject);
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

  })

  describe('parse type', function(){

    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.type);
    })

    it('should parse', function(){ 
      console.log("subject type: %o", this.subject);
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


  })

  describe('parse allOf', function(){

    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.allof);
    })

    it('should parse', function(){ 
      console.log("subject allof: %o", this.subject);
    })

    it('should parse each array item as a schema', function(){
      var allof = this.subject.get('allOf');
      allof.each(function(i,val){
        assert(val.nodeType == 'Schema'); 
      })
      assert(allof.get('0'));
      assert(allof.get(1));
      assert(allof.get('2'));
    })

  })



  // todo: more node types
  describe('parse other node types', function(){
    it('should have some tests, once I start implementing validation');
  })


  describe('search paths', function(){
    
    beforeEach(function(){
      this.subject = new Schema().parse(fixtures.search.all);
    })

    it('should find root from root', function(){
      assert(this.subject.$('#') === this.subject);
    })

    it('should find root from branch', function(){
      var branch = this.subject.get('definitions').get('one').get('type');
      assert(branch);
      assert(branch.$('#') === this.subject);
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

  })

  describe('scoping', function(){
    
    beforeEach(function(){
      this.subject = new Schema().parse(fixtures.scoping.all);
    })

    it('should set the top-level scope based on id', function(){
      assert(fixtures.scoping.all.id);
      assert(fixtures.scoping.all.id == this.subject.scope());
    })

    it('scope of non-schema subnodes should be nearest parent scope', function(){
      assert(fixtures.scoping.all.id == this.subject.get('properties').scope());
      assert('http://my.site/schema1' == this.subject.get('properties').get('path').get('properties').scope());
    })

    it('if no id specified, scope of schema subnodes should be nearest parent scope', function(){
      assert('http://my.site/myschema#fragment' == this.subject.get('properties').get('fragment').get('items').scope());
    })

    it('if id specified as URI fragment, scope of schema should be correctly joined to nearest parent scope', function(){
      assert('http://my.site/myschema#fragment' == this.subject.get('properties').get('fragment').scope());
    })

    it('if id specified as URI path, scope of schema should be correctly joined to nearest parent scope', function(){
      assert('http://my.site/schema1' == this.subject.get('properties').get('path').scope());
    })

    it('if id specified as full URI, scope of schema should be the given URI', function(){
      assert('http://my.site/another/schema#' == this.subject.get('properties').get('full').scope());
    })

  })

  // this is a bit internal, maybe should be redone using Node#eachRef, but it's easier testing this way
  describe('references', function(){

    function setupSchema(key){
      return new Schema().parse(fixtures.refs[key]);
    }
 
    it('should store URI fragment reference scoped to the schema', function(){
      this.subject = setupSchema('two');
      console.log('subject references: %o', this.subject);
      var ref = this.subject.ref('http://my.site/myschema#inner');
      assert(ref);
    })

    it('should store URI path reference scoped to the schema', function(){
      this.subject = setupSchema('one');
      assert( this.subject.ref('http://my.site/schema1'));
    })

    it('if no top-level id, should store URI path reference as-is', function(){
      this.subject = setupSchema('noid');
      assert( this.subject.ref('schema1'));
    })

    it('if no top-level id, should store URI fragment reference as-is', function(){
      this.subject = setupSchema('noid');
      assert( this.subject.ref('#/definitions/schema2'));
    })

    it('for forward reference, should store reference as array of node and key to be dereferenced', function(){
      this.subject = setupSchema('two');
      var ref = this.subject.ref('http://my.site/myschema#inner');
      assert(this.subject == ref[0]);
      assert('not' == ref[1]);
    })

    it('for backwards reference, should store reference as array of node and key to be dereferenced', function(){
      this.subject = setupSchema('one');
      var ref = this.subject.ref('http://my.site/schema1');
      assert(this.subject.get('definitions').get('schema2') == ref[0]);
      assert('items' == ref[1]);
    })

    it('if no top-level id, should store references as array of node and key to be dereferenced', function(){
      this.subject = setupSchema('noid');
      var ref = this.subject.ref('schema1');
      assert(this.subject.get('definitions').get('schema2') == ref[0]);
      assert('items' == ref[1]);
      ref = this.subject.ref('#/definitions/schema2');
      assert(this.subject == ref[0]);
      assert('not' == ref[1]);
    })

  })
  
  describe('binding', function(){
   
    function bindTo(sch,inst){
      var schema = new Schema().parse(fixtures.correlate[sch]);
      return schema.bind(fixtures.instance[inst]);
    }

    it('should bind to an instance', function(){
      var act = bindTo('simple', 'valid');
      assert(act);
    })
   
    it('should get sub-correlate', function(){
      var subject = bindTo('simple','valid');
      var expschema = subject.schema.get('properties').get('complex')
        , expinst = subject.instance.complex
      var act = subject.get('complex');
      assert(act);
      assert(expschema === act.schema);
      assert(expinst   === act.instance);
    })

    it('should get sub-correlate recursively', function(){
      var subject = bindTo('simple','valid');
      var expschema = subject.schema.get('properties').get('complex')
                                    .get('properties').get('two')
        , expinst = subject.instance.complex.two
      assert(expschema);
      assert(expinst);
      var act = subject.$('#/complex/two');
      assert(act);
      assert(expschema === act.schema);
      assert(expinst   === act.instance);
    })

    it('should return undefined if instance doesnt have specified property in schema', function(){
      var subject = bindTo('simple','invalid');
      var expschema = subject.schema.get('properties').get('complex')
                                    .get('properties').get('two')
        , expinst = subject.instance.complex.two
      assert(expschema);
      assert(expinst === undefined);
      var act = subject.$('#/complex/two');
      assert(act === undefined);
    })

    it('should return undefined if schema doesnt have specified property in instance', function(){
      var subject = bindTo('simple','additional');
      var expschema = subject.schema.get('properties').get('complex')
                                    .get('properties').get('four')
        , expinst = subject.instance.complex.four
      assert(expschema === undefined);
      assert(expinst);
      var act = subject.$('#/complex/four');
      assert(act === undefined);
    })
    
    it('should mix in binding method', function(){
      var subject = bindTo('simple','valid');
      assert(subject.nodeTypeAt);
    })
    
    it('binding method should be callable bound to correlation', function(){
      var subject = bindTo('simple','valid');
      assert('Schema' == subject.nodeTypeAt('#/properties/complex/properties/three'));
    })

  })

})



// fixtures

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

fixtures.parse.allof = {
  allOf: [
    fixtures.parse.simple,
    fixtures.parse.properties,
    fixtures.parse.type
  ]
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

fixtures.scoping = {};
fixtures.scoping.all = {
  id: "http://my.site/myschema#",
  properties: {
    fragment: {
      id: "#fragment",
      type: "array",
      items: { }
    },
    path: {
      id: "schema1",
      type: "object",
      properties: { 
        id: { type: "integer" }  
      }
    },
    full: {
      id: "http://my.site/another/schema#",
      type: "object",
      properties: { }
    }
  }
}


fixtures.refs = {};
fixtures.refs.one = {
  id: "http://my.site/myschema#",
  definitions: {
    schema1: {
      id: "schema1",
      type: "integer"
    },
    schema2: {
      type: "array",
      items: { "$ref": "schema1" }
    }
  }
}

fixtures.refs.two = {
  id: "http://my.site/myschema#",
  not: { "$ref": "#inner" },
  definitions: {
    schema1: {
      id: "#inner",
      type: "boolean"
    }
  }
}

fixtures.refs.noid = {
  definitions: {
    schema1: {
      id: "schema1",
      type: "integer"
    },
    schema2: {
      type: "array",
      items: { "$ref": "schema1" }
    }
  },
  not: { "$ref": "#/definitions/schema2" }
}


  
fixtures.correlate = {};
fixtures.correlate.simple = {
  properties: {
    simple: { type: 'string' },
    complex: { 
      type: 'object',
      properties: {
        one: {},
        two: {
          type: 'object',
          properties: {
            deep: {}
          }
        },
        three: {}
      }
    }
  }
}

fixtures.instance = {};
fixtures.instance.valid = {
  simple: "word",
  complex: {
    one: "of",
    two: {
      deep: "sea"
    },
    three: "kings"
  }
}

fixtures.instance.invalid = {
  simple: "man",
  complex: {
    one: "to",
    three: "years"
  }
}

fixtures.instance.additional = {
  simple: "giant",
  complex: {
    one: "hand",
    two: {
      deep: "trees"
    },
    three: "fellows",
    four: "sleep"
  }
}



