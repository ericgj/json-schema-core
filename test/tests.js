var assert = require('assert')
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

    it('should have type property', function(){
      assert(this.subject.property('type'));
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

  describe('parse additionalProperties', function(){

    beforeEach( function(){
      this.subject = new Schema().parse(fixtures.parse.additionalProperties);
    })

    it('should parse', function(){ 
      console.log("subject additionalProperties: %o", this.subject);
    })

    it('should parse object value as condition', function(){
      var act = this.subject.get('anyOf').get(1).get('additionalProperties');
      assert(act.nodeType == 'Schema');
    })

    it('should parse boolean value as property', function(){
      var act = this.subject.get('anyOf').get(0).property('additionalProperties');
      assert(act == false);
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
      var branch = this.subject.get('definitions').get('one');
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
 
    function findRef(u){
      var found
      this.eachRef( function(uri,node,key){
        if (!found && u == uri) found = [node,key];
      })
      return found;
    }
    
    function selectRefs(u){
      var found = []
      this.eachRef( function(uri,node,key){
        if (u == uri) found.push([node,key]);
      })
      return found;
    }

    it('should store URI fragment reference scoped to the schema', function(){
      this.subject = setupSchema('two');
      console.log('subject references: %o', this.subject);
      var ref = findRef.call(this.subject,'http://my.site/myschema#inner');
      assert(ref);
    })

    it('should store URI path reference scoped to the schema', function(){
      this.subject = setupSchema('one');
      assert( findRef.call(this.subject, 'http://my.site/schema1') );
    })

    it('if no top-level id, should store URI path reference as-is', function(){
      this.subject = setupSchema('noid');
      assert( findRef.call(this.subject, 'schema1') );
    })

    it('if no top-level id, should store URI fragment reference as-is', function(){
      this.subject = setupSchema('noid');
      assert( findRef.call(this.subject, '#/definitions/schema2') );
    })

    it('for forward reference, should store reference as array of node and key to be dereferenced', function(){
      this.subject = setupSchema('two');
      var ref = findRef.call(this.subject, 'http://my.site/myschema#inner');
      assert(this.subject == ref[0]);
      assert('not' == ref[1]);
    })

    it('for backwards reference, should store reference as array of node and key to be dereferenced', function(){
      this.subject = setupSchema('one');
      var ref = findRef.call(this.subject, 'http://my.site/schema1');
      assert(this.subject.get('definitions').get('schema2') == ref[0]);
      assert('items' == ref[1]);
    })

    it('if no top-level id, should store references as array of node and key to be dereferenced', function(){
      this.subject = setupSchema('noid');
      var ref = findRef.call(this.subject, 'schema1');
      assert(this.subject.get('definitions').get('schema2') == ref[0]);
      assert('items' == ref[1]);
      ref = findRef.call(this.subject, '#/definitions/schema2');
      assert(this.subject == ref[0]);
      assert('not' == ref[1]);
    })

    it('should store multiple references', function(){
      this.subject = setupSchema('multi');
      console.log('subject references multi: %o', this.subject);
      var refs = selectRefs.call(this.subject, 'http://my.site/schema1');
      assert(refs.length == 2);
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

    it('should get sub-correlate within array instance, single items schema', function(){
      var subject = bindTo('items','items');
      var expschema = subject.schema.get('properties').get('things').get('items')
        , expinst = subject.instance.things[1]
      assert(expschema);
      assert(expinst);
      var act = subject.$('things/1');
      assert(act);
      assert(expschema === act.schema);
      assert(expinst   === act.instance);
    })

    it('should get sub-correlate within array instance, multi items schema', function(){
      var subject = bindTo('itemsarray','items');
      var expschema = subject.schema.get('properties').get('things').get('items').get(2)
        , expinst = subject.instance.things[2]
      assert(expschema);
      assert(expinst);
      var act = subject.$('things/2');
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

  describe('Schema union', function(){
    
    beforeEach( function(){
      this.subject = [
        new Schema().parse(fixtures.union.one),
        new Schema().parse(fixtures.union.two),
        new Schema().parse(fixtures.union.three)
      ]
    })

    it('should construct schema with allOf condition', function(){
      var act = Schema.union(this.subject)
      console.log('subject Schema.union: %o', act);
      assert(act.get('allOf'));
      assert(act.get('allOf').get(0) == this.subject[0]);
      assert(act.get('allOf').get(1) == this.subject[1]);
      assert(act.get('allOf').get(2) == this.subject[2]);
    })

  })

  describe('serialization', function(){

    it('should serialize', function(){ 
      var subject = new Schema().parse(fixtures.serialize.all);
      var act = subject.toObject();
      console.log('serialize: %o', act);
      console.log('%s', subject.toString());
      assert.deepEqual(act,fixtures.serialize.all);
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

fixtures.parse.additionalProperties = {
  anyOf: [
    { 
      additionalProperties: false 
    },
    { 
      additionalProperties: fixtures.parse.properties
    }
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

fixtures.refs.multi = {
  id: "http://my.site/myschema#",
  definitions: {
    schema0: {
      type: "array",
      items: { "$ref": "schema1" }
    },
    schema1: {
      id: "schema1",
      type: "integer"
    }
  },
  properties: {
    one: { "$ref": "schema1" }
  }
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

fixtures.correlate.items = {
  properties: {
    things: {
      type: "array",
      items: { }
    }
  }
}

fixtures.correlate.itemsarray = {
  properties: {
    things: {
      type: "array",
      items: [ 
        { },
        { },
        { }
      ]
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

fixtures.instance.items = {
  things: [
    { }, 
    { },
    { }
  ]
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


fixtures.union = {};
fixtures.union.one = {
  id: '#one',
  properties: {
    "one": { type: "string" }
  }
}

fixtures.union.two = {
  id: '#two',
  properties: {
    "two": { type: "integer" }
  }
}

fixtures.union.three = {
  id: '#three',
  properties: {
    "three": { type: "array" }
  }
}



fixtures.serialize = {}
fixtures.serialize.all = {
  id: "http://test.me/schema#",
  properties: {
    one: {
      properties: {
        oneone: { }
      }
    },
    two: { }
  },
 allOf: [
   {
     description: "allOf 0",
   },
   {
     enum: [{ one: 1, two: 2 }, { one: 2, two: 1 }]
   }
 ],
 dependencies: {
   one: ["three", "five", "seven"],
   two: {
     properties: {
       "four": { type: "integer" },
       "six":  { type: "string"  }
     }
   }
 }
}
