'use strict'

const admin = require('firebase-admin-shadow')
const assert = require('assert')
const view = require('../lib/view')

/* global describe it */

describe('View API', () => {
  describe('view.validate()', () => {
    it('should failed with a non-array as description', () => {
      const description = {}

      assert.throws(
        () => view.validate(description), /The description must be an array/)
    })

    it('should failed with missing @ field', () => {
      const description = [{}]

      assert.throws(
        () => view.validate(description), /Missing @ field/)
    })

    it('should failed with a non-string value for the alias field', () => {
      const description = [
        { '@': 'people', '~': true }
      ]

      assert.throws(
        () => view.validate(description), /The query alias must be a string/)
    })

    it('should successfully validate with a string value for the alias field', () => {
      const description = [
        { '@': 'people', '~': 'users' }
      ]

      assert.doesNotThrow(() => view.validate(description))
    })

    it('should failed with a non-array value for the fields field', () => {
      const description = [
        { '@': 'people', ':': {} }
      ]

      assert.throws(
        () => view.validate(description), /The query projection must be an array/)
    })

    it('should successfully validate with an array value for the fields field', () => {
      const description = [
        { '@': 'people', ':': ['name'] }
      ]

      assert.doesNotThrow(() => view.validate(description))
    })

    it('should failed with a non-array value for the filters field', () => {
      const description = [
        { '@': 'people', '?': {} }
      ]

      assert.throws(
        () => view.validate(description), /The query filter must be an array/)
    })

    it('should successfully validate with an array value for the filters field', () => {
      const description = [
        { '@': 'people', '?': ['name'] }
      ]

      assert.doesNotThrow(() => view.validate(description))
    })
  })

  describe('view.compile()', () => {
    const results = [[{ firstname: 'Martin', lastname: 'King' }]]

    it('should successfully compile without relations', () => {
      const filters = [
        { where: { 'firstname': 'Martin' } }
      ]
      const expected = [ { where: { firstname: 'Martin' } } ]

      assert.deepEqual(view.compile(filters, results), expected)
    })

    it('should successfully compile with an empty filter', () => {
      const filters = [
        { where: { 'firstname': null } }
      ]
      const expected = filters

      assert.deepEqual(view.compile(filters, results), expected)
    })

    it('should successfully compile with missing index field', () => {
      const filters = [
        { where: { 'firstname': { 'k': 'v' } } }
      ]
      const expected = [ { where: { firstname: { k: 'v' } } } ]

      assert.deepEqual(view.compile(filters, results), expected)
    })

    it('should successfully compile with outbound index', () => {
      const filters = [
        { where: { 'firstname': { '$': results.length, ':': 'firstname' } } }
      ]
      const expected = [ { where: { 'firstname': null } } ]

      assert.deepEqual(view.compile(filters, results), expected)
    })

    it('should successfully compile with missing relation field', () => {
      const filters = [
        { where: { 'firstname': { '$': 0, ':': 'age' } } }
      ]
      const expected = [ { where: { 'firstname': null } } ]

      assert.deepEqual(view.compile(filters, results), expected)
    })

    it('should successfully compile filters', () => {
      const filters = [
        { where: { 'firstname': { '$': 0, ':': 'firstname' } } }
      ]
      const expected = [ { where: { firstname: 'Martin' } } ]

      assert.deepEqual(view.compile(filters, results), expected)
    })
  })

  describe('view.fetch()', () => {
    const dump = {
      heros: [
        { firstname: 'Rosa', lastname: 'Parks', born: 1913 },
        { firstname: 'Rosa Louise', lastname: 'McCauley Parks', born: 1913 },
        { firstname: 'Martin Luther', lastname: 'King Jr.', born: 1929 },
        { firstname: 'George', lastname: 'Washington', born: 1732 },
        { firstname: 'William', lastname: 'Shakespeare', born: 1564 }
      ],
      list: []
    }

    beforeEach(() => admin.database.import(dump))
    afterEach(() => admin.database.clear())

    it('should successfully retrieve data with filter', () => {
      const instance = admin.database()
      const query = {
        '@': 'heros',
        '?': [
          { where: { born: 1913 } }
        ]
      }
      const results = []
      const expected = dump.heros.filter((item) => {
        return item.born === 1913
      })

      return view.fetch(instance, query, results)
        .then((data) => assert.deepEqual(data, expected))
    })

    it('should successfully retrieve data from the given query', () => {
      const instance = admin.database()
      const query = {
        '@': 'heros',
        ':': ['firstname', 'lastname']
      }
      const results = []
      const expected = dump.heros.map((item) => {
        const clone = Object.assign({}, item)

        delete clone.born

        return clone
      })

      return view.fetch(instance, query, results)
        .then((data) => assert.deepEqual(data, expected))
    })

    it('should successfully retrieve an empty result set by filtering', () => {
      const instance = admin.database()
      const query = {
        '@': 'heros',
        '?': [
          { where: { born: new Date().getTime() } }
        ]
      }
      const results = []
      const expected = []

      return view.fetch(instance, query, results)
        .then((data) => assert.deepEqual(data, expected))
    })

    it('should successfully retrieve an empty result set from an empty snapshot', () => {
      const instance = admin.database()
      const query = { '@': 'list' }
      const results = []
      const expected = []

      return view.fetch(instance, query, results)
        .then((data) => assert.deepEqual(data, expected))
    })

    it('should successfully retrieve an empty result set from a non existence snapshot', () => {
      const instance = admin.database()
      const query = { '@': 'non-existence' }
      const results = []
      const expected = []

      return view.fetch(instance, query, results)
        .then((data) => assert.deepEqual(data, expected))
    })

    it('should successfully retrieve data with alias', () => {
      const instance = admin.database()
      const query = {
        '@': 'heros',
        '~': 'heros'
      }
      const results = []
      const expected = [{ [query['~']]: dump.heros }]

      return view.fetch(instance, query, results)
        .then((data) => assert.deepEqual(data, expected))
    })
  })

  describe('view.create()', () => {
    const dump = {
      heros: [
        { firstname: 'Rosa Louise', lastname: 'McCauley Parks', born: 1913, countryCode: 'us' },
        { firstname: 'Martin Luther', lastname: 'King Jr.', born: 1929, countryCode: 'us', countryCode: 'us' },
        { firstname: 'George', lastname: 'Washington', born: 1732, countryCode: 'us' },
        { firstname: 'Chaka', lastname: 'Zulu', born: 1787, countryCode: 'sa' },
        { firstname: 'William', lastname: 'Shakespeare', born: 1564, countryCode: 'uk' }
      ],
      countries: [
        { code: 'us', name: 'United States' },
        { code: 'sa', name: 'South Africa' },
        { code: 'uk', name: 'United Kingdom' }
      ]
    }

    beforeEach(() => admin.database.import(dump))
    afterEach(() => admin.database.clear())

    it('should successfully retrieve data with filter', () => {
      const instance = admin.database()
      const name = 'view-rosa-park'
      const description = [
        {
          '@': 'heros',
          ':': ['firstname', 'lastname', 'born'],
          '?': [
            { where: { born: 1787 } }
          ]
        },
        {
          '@': 'countries',
          '~': 'country',
          '?': [
            { where: { code: { '$': 0, ':': 'countryCode' } } }
          ]
        }
      ]
      const results = []
      const expected = [
        { firstname: 'Chaka',
          lastname: 'Zulu',
          born: 1787,
          country: {
            code: 'sa',
            name: 'South Africa' } }
      ]

      return view.create({ instance, name, description })
        .then((data) => assert.deepEqual(data, expected))
    })
  })
})
