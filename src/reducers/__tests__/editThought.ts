import { HOME_PATH, HOME_TOKEN } from '../../constants'
import { initialState, reducerFlow } from '../../util'
import { exportContext, getContexts, getAllChildren, getThought } from '../../selectors'
import { editThought, newThought, setCursor, importText } from '../../reducers'
import { SimplePath } from '../../types'
import checkDataIntegrity from '../../test-helpers/checkDataIntegrity'

it('edit a thought', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'b' }),
    setCursor({ path: [{ value: 'a', rank: 0 }] }),
    editThought({
      newValue: 'aa',
      oldValue: 'a',
      context: [HOME_TOKEN],
      path: [{ value: 'a', rank: 0 }] as SimplePath,
    }),
  ]
  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - aa
  - b`)

  // aa should exist in ROOT context
  expect(getContexts(stateNew, 'aa')).toMatchObject([
    {
      context: [HOME_TOKEN],
    },
  ])
  expect(getAllChildren(stateNew, [HOME_TOKEN])).toMatchObject([
    { value: 'b', rank: 1 },
    { value: 'aa', rank: 0 },
  ])

  // cursor should be at /aa
  expect(stateNew.cursor).toMatchObject([{ value: 'aa', rank: 0 }])
})

it('edit a descendant', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'a1', insertNewSubthought: true }),
    newThought({ value: 'b', at: [{ value: 'a', rank: 0 }] }),
    editThought({
      newValue: 'aa1',
      oldValue: 'a1',
      context: ['a'],
      path: [
        { value: 'a', rank: 1 },
        { value: 'a1', rank: 0 },
      ] as SimplePath,
    }),
  ]
  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - aa1
  - b`)

  // aa1 should exist in context a
  expect(getContexts(stateNew, 'aa1')).toMatchObject([
    {
      context: ['a'],
      rank: 0,
    },
  ])
  expect(getAllChildren(stateNew, ['a'])).toMatchObject([{ value: 'aa1', rank: 0 }])
})

it('edit a thought with descendants', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'a1', insertNewSubthought: true }),
    newThought({ value: 'a2' }),
    editThought({
      newValue: 'aa',
      oldValue: 'a',
      context: [HOME_TOKEN],
      path: [{ value: 'a', rank: 0 }] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - aa
    - a1
    - a2`)

  // aa should exist in ROOT context
  expect(getContexts(stateNew, 'aa')).toMatchObject([
    {
      context: [HOME_TOKEN],
    },
  ])
  expect(getAllChildren(stateNew, ['aa'])).toMatchObject([
    { value: 'a1', rank: 0 },
    { value: 'a2', rank: 1 },
  ])
})

it('edit a thought existing in mutliple contexts', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'ab', insertNewSubthought: true }),
    newThought({ value: 'b', at: [{ value: 'a', rank: 0 }] }),
    newThought({ value: 'ab', insertNewSubthought: true }),
    editThought({
      newValue: 'abc',
      oldValue: 'ab',
      context: ['a'],
      path: [{ value: 'a', rank: 0 }] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - abc
  - b
    - ab`)

  // abc should exist in context a
  expect(getContexts(stateNew, 'abc')).toMatchObject([
    {
      context: ['a'],
    },
  ])
  expect(getAllChildren(stateNew, ['a'])).toMatchObject([{ value: 'abc', rank: 0 }])
})

it('edit a thought that exists in another context', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'ab', insertNewSubthought: true }),
    newThought({ value: 'b', at: [{ value: 'a', rank: 0 }] }),
    newThought({ value: 'a', insertNewSubthought: true }),
    editThought({
      newValue: 'ab',
      oldValue: 'a',
      context: ['b'],
      path: [
        { value: 'b', rank: 1 },
        { value: 'a', rank: 0 },
      ] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - ab
  - b
    - ab`)

  // ab should exist in both contexts a and b
  expect(getContexts(stateNew, 'ab')).toMatchObject([
    {
      context: ['a'],
      rank: 0,
    },
    {
      context: ['b'],
      rank: 0,
    },
  ])

  expect(getAllChildren(stateNew, ['a'])).toMatchObject([{ value: 'ab', rank: 0 }])

  expect(getAllChildren(stateNew, ['a'])).toMatchObject([{ value: 'ab', rank: 0 }])
})

it('edit a child with the same value as its parent', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'a', insertNewSubthought: true }),
    editThought({
      newValue: 'ab',
      oldValue: 'a',
      context: ['a'],
      path: [
        { value: 'a', rank: 0 },
        { value: 'a', rank: 0 },
      ] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - ab`)

  // ab should exist in context a
  expect(getContexts(stateNew, 'ab')).toMatchObject([
    {
      context: ['a'],
      rank: 0,
    },
  ])
  expect(getAllChildren(stateNew, ['a'])).toMatchObject([{ value: 'ab', rank: 0 }])

  // cursor should be /a/ab
  expect(stateNew.cursor).toMatchObject([
    { value: 'a', rank: 0 },
    { value: 'ab', rank: 0 },
  ])
})

it('do not duplicate children when new and old context are same', () => {
  const steps = [
    newThought({ value: 'a' }),
    newThought({ value: 'b', insertNewSubthought: true }),
    editThought({
      newValue: 'as',
      oldValue: 'a',
      context: [HOME_TOKEN],
      path: [{ value: 'a', rank: 0 }] as SimplePath,
    }),
    editThought({
      newValue: 'a',
      oldValue: 'as',
      context: [HOME_TOKEN],
      path: [{ value: 'as', rank: 0 }] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

  expect(exported).toBe(`- ${HOME_TOKEN}
  - a
    - b`)
})

// Issue: https://github.com/cybersemics/em/issues/1095
it('data integrity test', () => {
  const text = `
    - a
      - b
        - d
      - d`

  const steps = [
    importText({
      text,
    }),
    setCursor({
      path: [
        {
          value: 'a',
          rank: 0,
        },
      ],
    }),
    editThought({
      newValue: 'azkaban',
      oldValue: 'a',
      context: [HOME_TOKEN],
      path: [{ value: 'a', rank: 0 }] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const { thoughtIndexUpdates, contextIndexUpdates } = checkDataIntegrity(stateNew)

  const thoughtUpdates = Object.keys(thoughtIndexUpdates).length
  const contextUpdates = Object.keys(contextIndexUpdates).length

  expect(thoughtUpdates).toBe(0)
  expect(contextUpdates).toBe(0)
})

// Issue: https://github.com/cybersemics/em/issues/1144
it('data integrity test after editing a parent with multiple descendants with same value and depth', () => {
  const text = `
  - ${' '}
    - a
      - m
    - b
      - m`

  const steps = [
    importText({
      text,
    }),
    setCursor({
      path: [
        {
          value: '',
          rank: 0,
        },
      ],
    }),
    editThought({
      newValue: 'x',
      oldValue: '',
      context: [HOME_TOKEN],
      path: [{ value: '', rank: 0 }] as SimplePath,
    }),
  ]

  // run steps through reducer flow and export as plaintext for readable test
  const stateNew = reducerFlow(steps)(initialState())
  const { thoughtIndexUpdates, contextIndexUpdates } = checkDataIntegrity(stateNew)

  const thoughtUpdates = Object.keys(thoughtIndexUpdates).length
  const contextUpdates = Object.keys(contextIndexUpdates).length

  expect(thoughtUpdates).toBe(0)
  expect(contextUpdates).toBe(0)
})

describe('changing thought with duplicate descendent', () => {
  it('adding', () => {
    const steps = [
      importText({
        path: HOME_PATH,
        text: `
      - a
        - b
          - ac`,
      }),
      editThought({
        newValue: 'ac',
        oldValue: 'a',
        context: [HOME_TOKEN],
        path: [{ value: 'a', rank: 0 }] as SimplePath,
      }),
    ]

    // run steps through reducer flow and export as plaintext for readable test
    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - ac
    - b
      - ac`)

    const lexeme = getThought(stateNew, 'ac')

    // Lexeme should be properly updated
    expect(lexeme?.contexts).toHaveLength(2)
  })

  it('removing', () => {
    const steps = [
      importText({
        path: HOME_PATH,
        text: `
      - a
        - b
          - a`,
      }),
      editThought({
        newValue: 'ac',
        oldValue: 'a',
        context: [HOME_TOKEN],
        path: [{ value: 'a', rank: 0 }] as SimplePath,
      }),
    ]

    // run steps through reducer flow and export as plaintext for readable test
    const stateNew = reducerFlow(steps)(initialState())
    const exported = exportContext(stateNew, [HOME_TOKEN], 'text/plain')

    expect(exported).toBe(`- ${HOME_TOKEN}
  - ac
    - b
      - a`)

    const lexeme = getThought(stateNew, 'a')
    // Lexeme should be properly updated
    expect(lexeme?.contexts).toHaveLength(1)
  })
})
