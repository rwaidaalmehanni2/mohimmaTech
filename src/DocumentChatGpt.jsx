import Lottie from 'lottie-react'
import React, { FC, useState, useRef, useEffect } from 'react'
import i18n from 'i18next'
import Tippy from '@tippy.js/react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import EditorBuild from 'ckeditor5-custom-build/build/ckeditor'
import 'ckeditor5-custom-build/build/translations/ar.js'
import 'ckeditor5-custom-build/build/translations/en-gb.js'
import Button, { ButtonVariant } from 'components/Buttons'
import { CommentsIcon, CrossSignIcon, InfoIcon } from 'components/Icons'
import { useWindowSize } from 'react-use'
import { useTranslation } from 'react-i18next'
import BaseModal from 'components/Dashboard/BaseModal/BaseModal'
import { nanoid } from 'nanoid'
import { configValues } from 'utils/appConfig'
import { useUpdateDocumentLoading } from 'features/station'
import Loader from 'components/Loader'
import ReactAudioPlayer from 'react-audio-player'
import classnames from 'classnames'
import { Tooltip } from '../../../utils/helpers/generalHelpers'
import { Input } from '../../inputs'
import robotAnimation from '../../../assets/lottie-robot-animation.json'

const getTitleAndBody = (editorData: string) => {
  const data = {
    body: '',
    title: '',
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(editorData, 'text/html')
  const title = doc.getElementsByTagName('h1')[0]
  data.title = title ? title.innerText : ''
  if (title) {
    doc.body.removeChild(title)
  }

  doc.body.childNodes.forEach((node: any) => {
    if (node.className === 'table') {
      if (!node.style.float) {
        if (node.className !== 'documentation-figure-center') {
          node.className = 'documentation-figure-center'
        }
      } else {
        node.className = ''
      }
      if (node.children[0].className !== 'documentation-table-default') {
        node.children[0].className = 'documentation-table-default'
      }
    }
  })

  data.body = doc.body.innerHTML

  return data
}
let a
const SUPPORTED_FILE_FORMATS = ['.mpeg', '.mp3', '.mp4', '.wav', '.wma', '.aac']
const DocumentChatGpt = ({ isRtl, data, saveChanges, exitWithoutSave, documentId, isSaveOpen, setSaveOpen, setHasChanges }) => {
  const [editedData, setEditedData] = React.useState(data)
  const [isAnimatingRobot, setAnimatingRobot] = useState(false)
  const [toggleTippy, setToggleTippy] = useState<boolean>(false)
  const ref = useRef<any>(null)
  const tippyParentRef = useRef(null)
  const [editorData, setEditorData] = React.useState(data)
  const { width: windowWidth } = useWindowSize()
  const { t } = useTranslation()
  const [isExitOpen, setExitOpen] = useState(false)
  const [removedFiles, setRemovedFiles] = useState<string[]>([])
  const [isCharactersWarningOpen, setIsCharactersWarningOpen] = useState<boolean>(false)
  const [chatQuestion, setChatQuestion] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const isUpdatingDocument = useUpdateDocumentLoading()
  const isImagesPublic = configValues.REACT_APP_IS_SECURE_CLOUD
  const [buttonName, setButtonName] = useState('Play')
  const [audio, setAudio] = useState(null)
  const [audioFile, setAudioFile] = useState(null)

  const additionalBtnWidth = windowWidth < 1001 ? 130 : 180
  useEffect(() => {
    if (a) {
      a.pause()
      a = null
      setButtonName('Play')
    }
    if (audio) {
      a = new Audio(audio)
      a.onended = () => {
        setButtonName('Play')
      }
    }
  }, [audio])

  const checkRemovedFiles = (event: any) => {
    const elementTypes = ['image', 'imageBlock', 'inlineImage', 'imageInline']

    const differ = event.source.differ

    // if no difference
    if (differ.isEmpty) {
      return
    }

    const changes = differ.getChanges({
      includeChangesInGraveyard: true,
    })

    if (changes.length === 0) {
      return
    }

    let hasNoImageRemoved = true

    // check any image remove or not
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]
      // if image remove exists
      if (change && change.type === 'remove' && elementTypes.includes(change.name)) {
        hasNoImageRemoved = false
        break
      }
    }

    // if not image remove stop execution
    if (hasNoImageRemoved) {
      return
    }

    // get removed nodes
    const removedNodes = changes.filter((change: any) => change.type === 'insert' && elementTypes.includes(change.name))

    // removed images src
    const removedImagesSrc: any[] = []
    // removed image nodes
    const removedImageNodes = []

    removedNodes.forEach((node: any) => {
      const removedNode = node.position.nodeAfter
      removedImageNodes.push(removedNode)
      removedImagesSrc.push(removedNode.getAttribute('src'))
    })
    const updatedRemovedFiles = [...removedFiles, ...removedImagesSrc]
    setRemovedFiles(updatedRemovedFiles)
  }

  // MARK: Editor Config
  const defaultConfig = {
    link: {
      addTargetToExternalLinks: true,
      decorators: [
        {
          attributes: {
            target: '_blank',
          },
        },
      ],
      defaultProtocol: 'https://',
    },
    mediaEmbed: { previewsInData: true },
    overflowY: 'auto',
    overflowY: 'auto',
    placeholder: t('documentation:editorPlaceholder'),
    simpleUpload: {
      // Enable the XMLHttpRequest.withCredentials property.
      // withCredentials: true,
      // Headers sent along with the XMLHttpRequest to the upload server.
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Arabic-Layout': i18n.language === 'ar',
        Authorization: localStorage.getItem('jwtToken') || '',
        // 'Content-Type': 'application/json',
      },

      // The URL that the images are uploaded to.
      uploadUrl: `${configValues.REACT_APP_API_URL}/api/wikipage/assets/element/${documentId}?assetType=0&sysTag=image&isPublic=${isImagesPublic}`,
    },
    tabSpaces: 4,
    width: '100%',
    width: '100%',
  }

  const handleChange = (event: any, editor: any) => {
    checkRemovedFiles(event)
    setHasChanges()

    const uniqueId = nanoid()
    editor.conversion.for('downcast').add((dispatcher: any) => {
      dispatcher.on('insert:paragraph', (evt: any, data: any, conversionApi: any) => {
        const viewWriter = conversionApi.writer

        viewWriter.setAttribute('id', 'doc-' + uniqueId, conversionApi.mapper.toViewElement(data.item))
      })
    })
    const contentWithoutTitle = editor.getData().split('</h1>')
    const content = contentWithoutTitle[1]
    if (content?.length > 10000) {
      setIsCharactersWarningOpen(true)
    } else {
      setIsCharactersWarningOpen(false)
    }
    setEditedData(editor.getData().replace('\r\n', '<br />'))
    setEditedData(editor.getData().replace('&nbsp;', ' '))
  }

  const handleOnReady = (editor: any) => {
    editor?.ui
      .getEditableElement()
      .parentElement.insertBefore(editor.ui.view.toolbar.element, editor.ui.getEditableElement())

    ref.current = editor
  }

  const handleOnError = ({ willEditorRestart }: any) => {
    if (willEditorRestart) {
      ref.current.ui.view.toolbar.element.remove()
    }
  }
  const generateDocumentContent = async () => {
    setIsSubmitting(true)
    setAnimatingRobot(true)
    const body = {
      messages: [
        {
          content: 'You are a helpful assistant. Your answers should not contain conversational elements',
          role: 'system',
        },
        {
          content: `${chatQuestion}. Don't respond as a conversation`,
          role: 'user',
        },
      ],
      model: 'gpt-3.5-turbo',
    }
    if (audioFile) {
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('model', 'whisper-1')
      const audioQuery: any = {
        body: formData,
        headers: {
          'customer-id': `${customerId}`,
          'x-api-key': `${xApiKey}`,
        },
        method: 'POST',
      }
      return await fetch(`https://experimental.willow.vectara.io/v1/audio/transcriptions`, audioQuery)
        .then((res) => res.json())
        .then((res) => {
          setToggleTippy(false)
          setIsSubmitting(false)
          setAnimatingRobot(false)
          setAudio(null)
          setAudioFile(null)
          a = null
          setEditorData(editorData + `<p>${res.text}</p>`)
        })
    } else {
      const query: any = {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'customer-id': `${customerId}`,
          'x-api-key': `${xApiKey}`,
        },
        method: 'POST',
      }
      return await fetch(`https://experimental.willow.vectara.io/v1/chat/completions`, query)
        .then((res) => res.json())
        .then((res) => {
          let content = '' + editorData
          res?.choices[0]?.message?.content
            ?.split('\n')
            .filter((p: string) => p !== '')
            .map((p: string) => {
              content += `<p>${p}</p>`
            })
          setToggleTippy(false)
          setIsSubmitting(false)
          setAnimatingRobot(false)
          setEditorData(content)
        })
    }
  }
  // MARK: END Editor config
  const handleClick = (playCase: string) => {
    switch (playCase) {
      case 'play':
        return a.play()
      default:
        return a.pause()
    }
  }

  const onCancelChatGptModal = () => {
    setOpenChatGpt(false)
    setAudio(null)
    setAudioFile(null)
    a = null
  }

  const addFile = (e) => {
    if (e.target.files[0]) {
      setAudio(URL.createObjectURL(e.target.files[0]))
      setAudioFile(e.target.files[0])
    }
  }
  return (
    <div className="relative flex w-full h-full border">
      <div
        style={{
          height: '100%',
          overflow: 'auto',
          width: `100%`,
        }}>
        {isRtl ? (
          <CKEditor
            className="editor"
            config={{
              language: 'ar',
              ...defaultConfig,
            }}
            data={editorData}
            editor={EditorBuild.Editor}
            ref={ref}
            onChange={handleChange}
            onError={handleOnError}
            onReady={handleOnReady}
          />
        ) : (
          <CKEditor
            className="editor"
            config={{
              language: 'en-gb',
              ...defaultConfig,
            }}
            data={editorData}
            editor={EditorBuild.Editor}
            ref={ref}
            onChange={handleChange}
            onError={handleOnError}
            onReady={handleOnReady}
          />
        )}
      </div>
      <div
        className={`absolute flex items-center lg:gap-3 lg:px-4 ${isRtl ? 'left-0' : 'right-0'} justify-end`}
        style={{
          borderBottom: '3px solid #eeeeee',
          borderLeft: !isRtl ? '1px solid #c4c4c4' : 'none',
          borderRight: isRtl ? '1px solid #c4c4c4' : 'none',
          fontSize: 14,
          height: 61,
          width: additionalBtnWidth,
        }}>
        <div>
          <Tippy
            animation="fade"
            appendTo={() => document.body}
            arrow={false}
            className={'top-zIndex'}
            content={
              <div className="flex flex-col p-4 bg-white rounded shadow-lg">
                <h1 className="mb-2">{t('chatGpt:autoGenerateDoc')}</h1>
                <Lottie
                  animationData={robotAnimation}
                  autoplay={isAnimatingRobot}
                  className="self-center mb-6 w-28"
                  loop={isAnimatingRobot}
                />
                <div className="pb-6 border-b border-gray-200">
                  <Input
                    autoFocus
                    classes={{ wrapper: 'px-1 text-sm w-full' }}
                    name="name"
                    placeholder={t('chatGpt:enterYourFeatureIdea')}
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => {
                      setChatQuestion(e.target.value)
                    }}
                  />
                </div>
                <div className="flex items-center justify-center w-full my-5">
                  {audio && (
                    <ReactAudioPlayer
                      autoPlay={false}
                      controls
                      src={audio}
                      onPause={() => {
                        handleClick('pause')
                      }}
                      onPlay={() => {
                        handleClick('play')
                      }}
                    />
                  )}
                  {!audio && (
                    <div className="flex items-center w-full px-1">
                      <input
                        accept={SUPPORTED_FILE_FORMATS.join(',')}
                        id="uploadAudio"
                        name="uploadAudio"
                        type="file"
                        onChange={addFile}
                      />
                      <label
                        className={classnames(
                          'w-full items-center px-2 text-sm font-bold text-center text-gray-600 border-2 border-gray-400' +
                            ' border-solid rounded py-2 shadow-sm transition-colors cursor-pointer hover:text-primary-dark hover:border-primary-dark',
                        )}
                        htmlFor="uploadAudio">
                        {t('chatGpt:uploadAudio')}
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-6 gap-4">
                  <Button variant={ButtonVariant.Outline} onClick={() => setToggleTippy(false)}>
                    {t('common:labels.cancel')}
                  </Button>
                  <Button variant={ButtonVariant.Primary} onClick={generateDocumentContent}>
                    {isSubmitting ? <Loader /> : t('chatGpt:createDoc')}
                  </Button>
                </div>
              </div>
            }
            interactive={true}
            isDestroyed={!toggleTippy}
            placement="top-end"
            reference={tippyParentRef}
            theme="calendar-tooltip"
            visible={toggleTippy}
            onHide={(data) => {
              setToggleTippy(false)
            }}>
            <div
              className="cursor-pointer"
              ref={tippyParentRef}
              onClick={() => {
                setToggleTippy(!toggleTippy)
              }}>
              AI
            </div>
          </Tippy>
        </div>
        {isCharactersWarningOpen && (
          <div
            key={isRtl + ''}
            id={'characters-warning'}
            onMouseOver={() => {
              Tooltip('#characters-warning', t('documentation:charactersErrorMessage'), 'bottom', 'custom-warning')
            }}>
            <Button className="text-danger hover:text-danger" icon={InfoIcon} small variant={ButtonVariant.Icon} />
          </div>
        )}
        <div>
          <Button
            className={getTitleAndBody(editedData).title !== '' ? '' : 'opacity-30 cursor-not-allowed'}
            small
            onClick={() => {
              if (getTitleAndBody(editedData).title !== '') {
                setSaveOpen(true)
              }
            }}>
            {t('dashboard:saveButton')}
          </Button>
        </div>
        <div>
          <Button small variant={ButtonVariant.Icon} onClick={() => setExitOpen(true)}>
            {windowWidth < 1001 ? <CrossSignIcon width={22} /> : t('dashboard:exitButton')}
          </Button>
        </div>
      </div>
      <BaseModal
        close={() => setSaveOpen(false)}
        content={
          <div>
            <h1>{t('dashboard:saveConfirmationMessage')}</h1>
            <div className="flex justify-end mt-6 gap-4">
              <Button variant={ButtonVariant.Outline} onClick={() => setSaveOpen(false)}>
                {t('common:labels.cancel')}
              </Button>
              <Button
                disabled={isUpdatingDocument}
                onClick={() => {
                  const saveData = getTitleAndBody(editedData)
                  saveChanges(saveData.body, saveData.title, removedFiles)
                }}>
                {isUpdatingDocument ? <Loader /> : t('dashboard:saveButton')}
              </Button>
            </div>
          </div>
        }
        header={''}
        isModalOpen={isSaveOpen}
        type="confirmation"
        withoutCloseBtn
      />
      <BaseModal
        close={() => setExitOpen(false)}
        content={
          <div>
            <h1>{t('dashboard:exitConfirmationMessage')}</h1>
            <div className="flex justify-end mt-6 gap-4">
              <Button variant={ButtonVariant.Outline} onClick={() => setExitOpen(false)}>
                {t('common:labels.cancel')}
              </Button>
              <Button variant={ButtonVariant.Danger} onClick={exitWithoutSave}>
                {t('dashboard:exitButton')}
              </Button>
            </div>
          </div>
        }
        header={''}
        isModalOpen={isExitOpen}
        type="confirmation"
        withoutCloseBtn
      />
    </div>
  )
}

export default DocumentEditor
