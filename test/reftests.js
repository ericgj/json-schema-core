var assert = require('timoxley-assert')
  , References = require('json-schema-core/refs')

fixtures = {};

///////////////////////////////////

describe('json-schema-core references', function(){
  describe('parse simple', function(){
    
    beforeEach( function(){
      this.subject = new References(fixtures.parse.one);
    })

    it('should parse', function(){ 
      console.log("subject one: %o", this.subject);
    })
    
    it('should store referents by canonicalized URI', function(){
      var act = this.subject.getReferent('http://my.site/myschema#');
      assert('#' == act);
      act = this.subject.getReferent('http://my.site/schema1');
      assert('#/definitions/schema1' == act);
    })

    it('should store referrers by path pointing to canonicalized URI', function(){
      var act = this.subject.getReferrer('#/definitions/schema2/items');
      assert('http://my.site/schema1' == act);
    })

  })

  describe('parse for inline dereferencing', function(){

    beforeEach( function(){
      this.subject = new References(fixtures.parse.two);
    })

    it('should parse', function(){ 
      console.log("subject two: %o", this.subject);
    })

    it('should store referrers by path pointing to canonicalized URI', function(){
      var act = this.subject.getReferrer('#/not');
      assert('http://some.site/schema#inner' == act);
    })
 
  })

  describe('parse, no top-level id', function(){

    beforeEach( function(){
      this.subject = new References(fixtures.parse.noid);
    })

    it('should parse', function(){ 
      console.log("subject noid: %o", this.subject);
    })

    it('should store referrers by path pointing to relative URI', function(){
      var act = this.subject.getReferrer('#/not');
      assert('#/definitions/schema2' == act);
      act = this.subject.getReferrer('#/definitions/schema2/items');
      assert('schema1' == act);
    })

  })

})


fixtures.parse = {}
fixtures.parse.one = {
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


fixtures.parse.two = {
  id: "http://some.site/schema#",
  not: { "$ref": "#inner" },
  definitions: {
    schema1: {
      id: "#inner",
      type: "boolean"
    }
  }
}

fixtures.parse.noid = {
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


