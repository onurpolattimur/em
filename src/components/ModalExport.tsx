import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import ClipboardJS from 'clipboard'
import { and } from 'fp-and-or'
import globals from '../globals'
import { HOME_PATH } from '../constants'
import {
  download,
  ellipsize,
  getExportPhrase,
  getPublishUrl,
  hashContext,
  headValue,
  isDocumentEditable,
  isFunction,
  isRoot,
  pathToContext,
  removeHome,
  timestamp,
  unroot,
} from '../util'
import { alert, error, closeModal, pull } from '../action-creators'
import { exportContext, getAllChildren, simplifyPath, theme } from '../selectors'
import Modal from './Modal'
import DropDownMenu from './DropDownMenu'
import LoadingEllipsis from './LoadingEllipsis'
import ChevronImg from './ChevronImg'
import { State } from '../util/initialState'
import { isTouch } from '../browser'
import useOnClickOutside from 'use-onclickoutside'
import { Child, ExportOption } from '../types'

interface AdvancedSetting {
  id: string
  onChangeFunc: () => void
  defaultChecked: boolean
  checked: boolean
  title: string
  description: string
}

const exportOptions: ExportOption[] = [
  { type: 'text/plain', label: 'Plain Text', extension: 'txt' },
  { type: 'text/html', label: 'HTML', extension: 'html' },
]

/** A modal that allows the user to export, download, share, or publish their thoughts. */
const ModalExport = () => {
  const store = useStore()
  const dispatch = useDispatch()
  const isMounted = useRef(false)
  const state = store.getState()
  const cursor = useSelector((state: State) => state.cursor || HOME_PATH)
  const simplePath = simplifyPath(state, cursor)
  const context = pathToContext(simplePath)
  const contextTitle = unroot(context.concat(['=publish', 'Title']))
  const titleChild = getAllChildren(state, contextTitle)[0]
  const title = isRoot(cursor) ? 'home' : titleChild ? titleChild.value : headValue(cursor)
  const titleShort = ellipsize(title)
  const titleMedium = ellipsize(title, 25)

  const [selected, setSelected] = useState(exportOptions[0])
  const [isOpen, setIsOpen] = useState(false)
  const [wrapperRef, setWrapper] = useState<HTMLElement | null>(null)
  const [exportContent, setExportContent] = useState<string | null>(null)
  const [shouldIncludeMetaAttributes, setShouldIncludeMetaAttributes] = useState(true)
  const [shouldIncludeArchived, setShouldIncludeArchived] = useState(true)

  const dark = theme(state) !== 'Light'
  const themeColor = { color: dark ? 'white' : 'black' }
  const themeColorWithBackground = dark
    ? { color: 'black', backgroundColor: 'white' }
    : { color: 'white', backgroundColor: 'black' }

  const exportWord = isTouch ? 'Share' : 'Download'

  const exportThoughtsPhrase = getExportPhrase(state, simplePath, {
    filterFunction: and(
      shouldIncludeMetaAttributes || ((child: Child) => !isFunction(child.value)),
      shouldIncludeArchived || ((child: Child) => child.value !== '=archive'),
    ),
    value: title,
  })

  /** Sets the exported context from the cursor using the selected type and making the appropriate substitutions. */
  const setExportContentFromCursor = () => {
    const exported = exportContext(store.getState(), context, selected.type, {
      title: titleChild ? titleChild.value : undefined,
      excludeMeta: !shouldIncludeMetaAttributes,
      excludeArchived: !shouldIncludeArchived,
    })

    setExportContent(titleChild ? exported : removeHome(exported).trimStart())
  }

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
  }, [])

  const dropDownRef = React.useRef<HTMLDivElement>(null)
  useOnClickOutside(dropDownRef, closeDropdown)

  // fetch all pending descendants of the cursor once before they are exported
  useEffect(() => {
    if (!isMounted.current) {
      // track isMounted so we can cancel the call to setExportContent after unmount
      isMounted.current = true
      dispatch(pull({ [hashContext(context)]: context }, { maxDepth: Infinity })).then(() => {
        if (isMounted.current) {
          setExportContentFromCursor()
        }
      })
    } else {
      setExportContentFromCursor()
    }

    if (!shouldIncludeMetaAttributes) setShouldIncludeArchived(false)

    return () => {
      isMounted.current = false
    }
  }, [selected, shouldIncludeMetaAttributes, shouldIncludeArchived])

  useEffect(() => {
    document.addEventListener('click', onClickOutside)

    const clipboard = new ClipboardJS('.copy-clipboard-btn')

    clipboard.on('success', () => {
      // Note: clipboard leaves unwanted text selection after copy operation. so removing it to prevent issue with gesture handler
      if (document.getSelection()?.toString()) document.getSelection()?.removeAllRanges()

      dispatch([
        closeModal(),
        alert(`Copied ${exportThoughtsPhrase} to the clipboard`, { alertType: 'clipboard', clearTimeout: 3000 }),
      ])

      clearTimeout(globals.errorTimer)
    })

    clipboard.on('error', e => {
      console.error(e)
      dispatch(error({ value: 'Error copying thoughts' }))

      clearTimeout(globals.errorTimer)
      globals.errorTimer = window.setTimeout(() => dispatch(alert(null, { alertType: 'clipboard' })), 10000)
    })

    return () => {
      document.removeEventListener('click', onClickOutside)
      clipboard.destroy()
    }
  }, [exportThoughtsPhrase])

  const [publishing, setPublishing] = useState(false)
  const [publishedCIDs, setPublishedCIDs] = useState([] as string[])

  /** Updates the isOpen state when clicked outside modal. */
  const onClickOutside = (e: MouseEvent) => {
    if (isOpen && wrapperRef && !wrapperRef.contains(e.target as Node)) {
      setIsOpen(false)
      e.stopPropagation()
    }
  }

  /** Shares or downloads when the export button is clicked. */
  const onExportClick = () => {
    // use mobile share if it is available
    if (navigator.share) {
      navigator.share({
        text: exportContent!,
        title: titleShort,
      })
    }
    // otherwise download the data with createObjectURL
    else {
      try {
        download(exportContent!, `em-${title}-${timestamp()}.${selected.extension}`, selected.type)
      } catch (e) {
        dispatch(error({ value: e.message }))
        console.error('Download Error', e.message)
      }
    }

    dispatch(closeModal())
  }

  /** Publishes the thoughts to IPFS. */
  const publish = async () => {
    setPublishing(true)
    setPublishedCIDs([])
    const cids = []

    const { default: IpfsHttpClient } = await import('ipfs-http-client')
    const ipfs = IpfsHttpClient({ host: 'ipfs.infura.io', port: 5001, protocol: 'https' })

    // export without =src content
    const exported = exportContext(store.getState(), context, selected.type, {
      excludeSrc: true,
      excludeMeta: !shouldIncludeMetaAttributes,
      excludeArchived: !shouldIncludeArchived,
      title: titleChild ? titleChild.value : undefined,
    })

    // eslint-disable-next-line fp/no-loops
    for await (const result of ipfs.add(exported)) {
      if (result && result.path) {
        const cid = result.path
        // TODO: prependRevision is currently broken
        // dispatch(prependRevision({ path: cursor, cid }))
        cids.push(cid) // eslint-disable-line fp/no-mutating-methods
        setPublishedCIDs(cids)
      } else {
        setPublishing(false)
        setPublishedCIDs([])
        dispatch(error({ value: 'Publish Error' }))
        console.error('Publish Error', result)
      }
    }

    setPublishing(false)
  }

  const [advancedSettings, setAdvancedSettings] = useState(false)

  /** Toggles advanced setting when Advanced CTA is clicked. */
  const onAdvancedClick = () => setAdvancedSettings(!advancedSettings)

  /** Updates lossless checkbox value when clicked and set the appropriate value in the selected option. */
  const onChangeLosslessCheckbox = () => setShouldIncludeMetaAttributes(!shouldIncludeMetaAttributes)

  /** Updates archived checkbox value when clicked and set the appropriate value in the selected option. */
  const onChangeArchivedCheckbox = () => setShouldIncludeArchived(!shouldIncludeArchived)

  /** Created an array of objects so that we can just add object here to get multiple checkbox options created. */
  const advancedSettingsArray: AdvancedSetting[] = [
    {
      id: 'lossless-checkbox',
      onChangeFunc: onChangeLosslessCheckbox,
      defaultChecked: true,
      checked: shouldIncludeMetaAttributes,
      title: 'Lossless',
      description:
        'When checked, include all metaprogramming attributes such as archived thoughts, pins, table view, etc. Check this option for a backup-quality export that can be re-imported with no data loss. Uncheck this option for social sharing or exporting to platforms that do not support em metaprogramming attributes. Which is, uh, all of them.',
    },
    {
      id: 'archived-checkbox',
      onChangeFunc: onChangeArchivedCheckbox,
      defaultChecked: true,
      checked: shouldIncludeArchived,
      title: 'Archived',
      description: 'When checked, the exported thoughts include archived thoughts.',
    },
  ]

  return (
    <Modal id='export' title='Export' className='popup'>
      {/* Export message */}
      <div className='modal-export-wrapper'>
        <span className='modal-content-to-export'>
          <span>
            {exportWord} <span dangerouslySetInnerHTML={{ __html: exportThoughtsPhrase }} />
            <span>
              {' '}
              as{' '}
              <span ref={dropDownRef} style={{ position: 'relative', whiteSpace: 'nowrap', userSelect: 'none' }}>
                <a style={themeColor} onClick={() => setIsOpen(!isOpen)}>
                  {selected.label}
                </a>
                <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                  <ChevronImg
                    dark={dark}
                    onClickHandle={() => setIsOpen(!isOpen)}
                    className={isOpen ? 'rotate180' : ''}
                  />
                  <span ref={setWrapper}>
                    <DropDownMenu
                      isOpen={isOpen}
                      selected={selected}
                      onSelect={(option: ExportOption) => {
                        setSelected(option)
                        setIsOpen(false)
                      }}
                      options={exportOptions}
                      dark={dark}
                      style={{
                        top: '120%',
                        left: 0, // position on the left edge of "Plain Text", otherwise the left side gets cut off on mobile
                        display: 'table', // the only value that seems to overflow properly within the inline-flex element
                        padding: 0,
                      }}
                    />
                  </span>
                </span>
              </span>
            </span>
          </span>
        </span>
      </div>

      {/* Preview */}
      <textarea
        readOnly
        style={{
          backgroundColor: '#111',
          border: 'none',
          borderRadius: '10px',
          color: '#aaa',
          fontSize: '1em',
          height: '120px',
          marginBottom: '20px',
          width: '300px',
        }}
        value={exportContent || ''}
      ></textarea>

      {/* Download button */}
      <div className='modal-export-btns-wrapper'>
        <button
          className='modal-btn-export'
          disabled={exportContent === null}
          onClick={onExportClick}
          style={themeColorWithBackground}
        >
          {exportWord}
        </button>
      </div>

      {/* Copy to clipboard */}
      <div className='cp-clipboard-wrapper'>
        {exportContent !== null ? (
          <a data-clipboard-text={exportContent} className='copy-clipboard-btn'>
            Copy to clipboard
          </a>
        ) : (
          <LoadingEllipsis />
        )}
      </div>

      {/* Advanced Settings */}
      <div className='advance-setting-wrapper'>
        <span>
          <a
            className='advance-setting-link no-select'
            onClick={onAdvancedClick}
            style={{ opacity: advancedSettings ? 1 : 0.5 }}
          >
            Advanced
          </a>
        </span>
        <span className='advance-setting-chevron'>
          <ChevronImg
            dark={dark}
            onClickHandle={onAdvancedClick}
            className={advancedSettings ? 'rotate180' : ''}
            additonalStyle={{ opacity: advancedSettings ? 1 : 0.5 }}
          />
        </span>
      </div>

      {advancedSettings && (
        <div className='advance-setting-section'>
          {advancedSettingsArray.map(({ id, onChangeFunc, defaultChecked, checked, title, description }) => {
            return (
              <label className='checkbox-container' key={`${id}-key-${title}`}>
                <div>
                  <p className='advance-setting-label'>{title}</p>
                  <p className='advance-setting-description dim'>{description}</p>
                </div>
                <input
                  type='checkbox'
                  id={id}
                  checked={checked}
                  onChange={onChangeFunc}
                  defaultChecked={defaultChecked}
                />
                <span className='checkmark'></span>
              </label>
            )
          })}
        </div>
      )}

      {/* Publish */}

      {isDocumentEditable() && (
        <>
          <div className='modal-export-publish'>
            {publishedCIDs.length > 0 ? (
              <div>
                Published:{' '}
                {publishedCIDs.map(cid => (
                  <a
                    key={cid}
                    target='_blank'
                    rel='noopener noreferrer'
                    href={getPublishUrl(cid)}
                    dangerouslySetInnerHTML={{ __html: titleMedium }}
                  />
                ))}
              </div>
            ) : (
              <div>
                <p>
                  {publishing ? (
                    'Publishing...'
                  ) : (
                    <span>
                      Publish <span dangerouslySetInnerHTML={{ __html: exportThoughtsPhrase }} />.
                    </span>
                  )}
                </p>
                <p className='dim'>
                  <i>
                    Note: These thoughts are published permanently. <br />
                    This action cannot be undone.
                  </i>
                </p>
              </div>
            )}
          </div>

          <div className='modal-export-btns-wrapper'>
            <button
              className='modal-btn-export'
              disabled={!exportContent || publishing || publishedCIDs.length > 0}
              onClick={publish}
              style={themeColorWithBackground}
            >
              Publish
            </button>

            {(publishing || publishedCIDs.length > 0) && (
              <button
                className='modal-btn-cancel'
                onClick={() => {
                  dispatch([alert(null), closeModal()])
                }}
                style={{
                  fontSize: '14px',
                  ...themeColor,
                }}
              >
                Close
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

export default ModalExport
