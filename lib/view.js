'use strict'

const _ = require('underscore')

const DEFAULT_SCOPE = '@views'
const QUERY_PATH = '@'
const QUERY_ALIAS = '~'
const QUERY_FIELDS = ':'
const QUERY_FILTERS = '?'
const QUERY_INDEX = '$'

const validate = (description) => {
  if (!Array.isArray(description)) {
    throw new TypeError('The description must be an array')
  }

  description.forEach((query) => {
    if (!query.hasOwnProperty(QUERY_PATH)) {
      throw new SyntaxError('Missing @ field')
    }

    if (query.hasOwnProperty(QUERY_ALIAS)) {
      if (typeof query[QUERY_ALIAS] !== 'string') {
        throw new TypeError('The query alias must be a string')
      }
    }

    if (query.hasOwnProperty(QUERY_FIELDS)) {
      if (!Array.isArray(query[QUERY_FIELDS])) {
        throw new TypeError('The query projection must be an array')
      }
    }

    if (query.hasOwnProperty(QUERY_FILTERS)) {
      if (!Array.isArray(query[QUERY_FILTERS])) {
        throw new TypeError('The query filter must be an array')
      }
    }
  })
}

const compile = (filters, results) => {
  return filters.reduce((compiledFilters, filter) => {
    for (let op in filter) {
      const entry = filter[op]
      const compiledEntry = {}

      for (let path in entry) {
        const value = compiledEntry[path] = entry[path]

        if (value instanceof Array || value === null || typeof value !== 'object') {
          continue
        }

        if (!value.hasOwnProperty(QUERY_INDEX)) {
          continue
        }

        compiledEntry[path] = null

        const index = value[QUERY_INDEX]

        if (index >= results.length) {
          continue
        }

        const key = value[QUERY_FIELDS]
        const records = results[index]

        if (records.length === 0) {
          continue
        }

        const record = records[0]

        if (!record.hasOwnProperty(key)) {
          continue
        }

        compiledEntry[path] = record[key]
      }

      compiledFilters.push({ [op]: compiledEntry })
    }

    return compiledFilters
  }, [])
}

const fetch = (instance, query, results) => {
  return instance.ref(query[QUERY_PATH]).once('value')
    .then((snapshot) => {
      let data = {}
      let values = []

      snapshot.forEach((snap) => values.push(snap.val()))

      if (values.length) {
        if (query.hasOwnProperty(QUERY_FILTERS)) {
          const filters = query[QUERY_FILTERS]

          values = compile(filters, results).reduce((array, filter) => {
            for (let fn in filter) {
              array = _[fn].call(null, array, filter[fn])
            }

            return array
          }, values)
        }

        results.push(JSON.parse(JSON.stringify(values)))

        if (query.hasOwnProperty(QUERY_FIELDS)) {
          const fields = query[QUERY_FIELDS]

          values.forEach((value) => {
            for (let key in value) {
              if (!fields.includes(key)) {
                delete value[key]
              }
            }
          })
        }
      } else {
        results.push(values)
      }

      if (query.hasOwnProperty(QUERY_ALIAS)) {
        if (values instanceof Array) {
          if (values.length === 1) {
            values = values[0]
          }
        }

        data = [{ [query[QUERY_ALIAS]]: values }]
      } else {
        data = values instanceof Array ? values : [ values ]
      }

      return data
    })
    .catch(() => Promise.resolve([]))
}

const create = ({ instance, name, description, scope = DEFAULT_SCOPE }) => {
  validate(description)

  const results = []
  const processes = description.map((query) => fetch(instance, query, results))

  return Promise.all(processes).then((results) => {
    let data = []

    if (results.length) {
      data = results[0].map((record, i) => {
        results.slice(1).forEach((records) => {
          record = Object.assign(record, records[i])
        })

        return record
      })
    }

    instance.ref(scope).child(name).set(data)

    return data
  })
}

module.exports = { validate, compile, fetch, create }
