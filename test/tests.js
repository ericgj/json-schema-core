var assert = require('timoxley-assert')
  , Schema = require('json-schema-core')


fixtures = {};


///////////////////////////////////

describe('json-schema-core', function(){
  describe('parse simple', function(){
    
    beforeEach( function(){
      this.subject = new Schema(fixtures.parse.simple);
    })

    it('should parse', function(){ 
      console.log("subject: %o", this.subject);
    })

    it('should have type and properties conditions', function(){
      var conditions = this.subject.$
      assert(conditions.type);
      assert(conditions.properties);
    })

    it('should have links properties', function(){
      var props = this.subject.properties;
      assert(props.links);
    })
    
    it('should store path with schema root', function(){
      var conditions = this.subject.$
      assert('#' == this.subject.path);
    })

    it('should store path with each condition node', function(){
      var conditions = this.subject.$
      assert('#/properties' == conditions.properties.path);
      assert('#/type' == conditions.type.path);
    })

  })

  describe('parse properties', function(){

    beforeEach( function(){
      this.subject = new Schema(fixtures.parse.properties);
    })

    it('should parse', function(){ 
      console.log("subject: %o", this.subject);
    })

    it('should parse each property value as a schema', function(){
      var props = this.subject.$.properties;
      props.each(function(key,val){
        assert(val.constructor == Schema);
      })
      assert(props.get('one'));
      assert(props.get('two'));
      assert(props.get('three'));
    })

    it('should store path with each condition node and each schema under properties', function(){
      var props = this.subject.$.properties;
      assert('#/properties' == props.path);
      assert('#/properties/one' == props.get('one').path);
      assert('#/properties/two' == props.get('two').path);
      assert('#/properties/three' == props.get('three').path);
      assert('#/properties/one/type' == props.get('one').$.type.path);
      assert('#/properties/two/type' == props.get('two').$.type.path);
      assert('#/properties/three/type' == props.get('three').$.type.path);
    })

  })

  describe('parse type', function(){

    beforeEach( function(){
      this.subject = new Schema(fixtures.parse.type);
    })

    it('should parse simple type', function(){
      var props = this.subject.$.properties
        , prop = props.get('simple')
        , type = prop.$.type
      assert(type.value() == 'string');
      assert(!type.isArray());
    })

    it('should parse multi value type', function(){
      var props = this.subject.$.properties
        , prop = props.get('multi')
        , type = prop.$.type
      assert(type.isArray());
      assert.deepEqual(['string','numeric','enum'],type.values());
    })


  })

})

fixtures.parse = {};
fixtures.parse.simple = {
  type: 'object',
  links: { },
  properties: {}
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

