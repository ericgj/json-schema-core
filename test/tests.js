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

    it('should have links additionalProperties', function(){
      var additionalProps = this.subject.additionalProperties;
      assert(additionalProps.links);
    })

  })

  describe('parse properties', function(){

    beforeEach( function(){
      this.subject = new Schema(fixtures.parse.properties);
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
      assert.deepEqual(['string','numeric','enum'],type.value());
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

