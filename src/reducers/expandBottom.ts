import { expandThoughts } from '../selectors'
import { Path } from '../types'
import { hashContext, pathToContext } from '../util'
import { State } from '../util/initialState'

interface Options {
  path: Path
}

/**
 * Calculates the expanded context due to hover expansion on empty child drop.
 */
const expandBottom = (state: State, { path }: Options): State => {
  const contextHash = hashContext(pathToContext(path))
  const expandHoverBottomPaths = { ...state.expandHoverBottomPaths, [contextHash]: path }

  const expandedBottomPaths = Object.values(expandHoverBottomPaths)
  // expanded thoughts due to hover expansion
  const updatedExpandedBottom = expandedBottomPaths.reduce(
    (acc, path) => ({ ...acc, ...expandThoughts(state, path) }),
    {},
  )

  return { ...state, expandHoverBottomPaths, expandedBottom: updatedExpandedBottom }
}

export default expandBottom
