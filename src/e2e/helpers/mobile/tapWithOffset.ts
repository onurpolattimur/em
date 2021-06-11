import { Browser } from 'webdriverio'
import getNativeElementRect from './getNativeElementRect'

interface Options {
  // Where in the horizontal line (inside) of the target node should be tapped
  horizontalTapLine?: 'left' | 'right',
  // Specify specific node on editable to tap. Overrides horizontalClickLine
  offset?: number,
  // Number of pixels of x offset to add to the tap coordinates
  x?: number,
  // Number of pixels of y offset to add to the tap coordinates
  y?: number,
}

/**
 * Tap the given node with offset.
 */
const tapWithOffset = async (browser: Browser<'async'>, nodeHandle: any, { horizontalTapLine = 'left', offset, x = 0, y = 0 }: Options) => {
  const boundingBox = await browser.getElementRect(nodeHandle.elementId)
  if (!boundingBox) throw new Error('Bouding box of editable not found.')

  /** Get cordinates for specific text node if the given node has text child. */
  const offsetCoordinates = async () => {
    return await browser.execute(
      function(ele, offset) {
        const textNode = ele.firstChild
        if (!textNode || textNode.nodeName !== '#text') return
        const range = document.createRange()
        range.setStart(textNode, offset ?? 0)
        const { right, top, height } = range.getBoundingClientRect()
        return {
          x: right,
          y: top + (height / 2)
        }
      },
      nodeHandle, offset
    )
  }

  const coordinate = !offset ? {
    x: boundingBox.x + (
      horizontalTapLine === 'left' ? 0
      : horizontalTapLine === 'right' ? boundingBox.width - 1
      : boundingBox.width / 2
    ),
    y: boundingBox.y + (boundingBox.height / 2)
  } : await offsetCoordinates()

  if (!coordinate) throw new Error('Coordinate not found.')

  const topBarRect = await getNativeElementRect(browser, '//XCUIElementTypeOther[@name="TopBrowserBar"]')

  await browser.touchAction({
    action: 'tap',
    x: coordinate.x + x,
    y: coordinate.y + y + (topBarRect.y + topBarRect.height + 3),
  })

}

export default tapWithOffset