import React, { FC, useEffect, useMemo, useRef, useState } from 'react'
import classnames from 'classnames'
import { NavLink, Route, Switch, useHistory, useParams, useRouteMatch } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRoles } from 'hooks'
import { useDispatch } from 'react-redux'
import { isNumber } from 'lodash'

import { AddRecordToListForm } from 'components/forms'
import RecordFilters from 'components/RecordFilters'
import {
  ArchiveIcon,
  CalendarAgendaIcon,
  CalendarCardIcon,
  GridIcon,
  KanbanIcon,
  SettingsIcon,
  TimelineIcon,
  ViewsIcon,
} from 'components/Icons'

import ListToolbar from 'components/ListToolbar'
import Loader from 'components/Loader'

import { fetchListById, useCurrentList, useCurrentListLoading } from 'features/list'
import { fetchUsersByListId, useCurrentUser } from 'features/user'
import { clearFilters, clearRecords, createRecord, fetchRecordsByParams, setCurrentRecord } from 'features/record'
import { useHasCurrentWorkspacePremiumPlan } from 'features/workspace'
import { fetchGridViewsByListId, useGridViews } from 'features/listGrid'

import { useAppDispatch } from 'store'
import RecordsListingPage from 'pages/record/RecordsListingPage'
import KanbanViewPage from 'pages/record/KanbanView'
import Calendar from 'pages/record/Calendar'
import Timeline from 'pages/record/Timeline'
import ListSettingsPage from 'pages/list/ListSettingsPage'

import { getQueryParamValue } from 'utils/helpers/queryParamsHelper'
import { customFieldBaseTypes } from 'utils/helpers/customFields'
import { usePanel } from 'contexts/PanelContext'

import Tippy from '@tippy.js/react'
import Lottie from 'lottie-react'
import ReactAudioPlayer from 'react-audio-player'
import { clearGridView } from '../../features/listGrid/listGridSlice'
import CalendarAgendaView from '../record/CalendarAgendaView'
import StackBy from '../../components/StackBy/StackBy'
import { getListLinkOptions } from '../../features/element'
import { RECORDS_PER_PAGE } from '../../utils/helpers/recordHelpers'
import robotAnimation from '../../assets/lottie-robot-animation.json'
import { Input } from '../../components/inputs'
import Button, { ButtonVariant } from '../../components/Buttons'

type SingleViewTypeType = {
  Icon: FC<React.SVGAttributes<SVGElement>>,
  text: string,
  requirePremium: boolean,
  url: string,
}

const AutoCreateTasks = () => {
  const [isSidePanelVisible, setIsSidePanelVisible] = useState<boolean>(true)
  const appDispatch = useAppDispatch()
  const {
    listId,
    viewType: currentViewType,
    viewTypeId: currentViewTypeId,
  } = useParams<{
    listId: string,
    viewType: string,
    viewTypeId: string,
  }>()
  const {
    location: { search, state },
  }: { location: { search: string | undefined, state: any } } = useHistory()
  const recordIdFromUrl = useMemo(() => getQueryParamValue(search, 'recordId'), [search])
  const { t, i18n } = useTranslation()
  const gridViews = useGridViews()
  const list = useCurrentList()
  const currentListLoading = useCurrentListLoading()
  const { url } = useRouteMatch()
  const dispatch = useDispatch()
  const isRtl = i18n.language === 'ar'
  const { isEditor, isAdmin } = useRoles()
  const isPremiumPlan = useHasCurrentWorkspacePremiumPlan()
  const [isArchived, setIsArchived] = useState(false)
  const { setPanelContent, openPanel, isPanelOpen } = usePanel()
  const [isAnimatingRobot, setAnimatingRobot] = useState(false)
  const [toggleTippy, setToggleTippy] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [chatQuestion, setChatQuestion] = useState<string>('')
  const ref = useRef<any>(null)
  const tippyParentRef = useRef(null)

  const urlBase = useMemo(
    () => url.replace(currentViewTypeId ? `/${currentViewType}/${currentViewTypeId}` : `/${currentViewType}`, ''),
    [url, currentViewType],
  )

  useEffect(() => {
    if (list?.appElement) {
      setIsArchived(list?.appElement.archivedById !== null || list?.appElement?.isArchived)
    }
  }, [list])

  const onArchive = (status?: boolean) => {
    const archiveStatus = status !== undefined ? status : isArchived
    appDispatch(fetchRecordsByParams({ archiveStatus: Number(archiveStatus), limit: RECORDS_PER_PAGE, listId })).then(
      (res) => {
        if (res.payload[0]) {
          const currentListId = res?.payload[0]?.id
          dispatch(fetchListById(currentListId))
        }
      },
    )
  }

  useEffect(() => {
    return () => {
      dispatch(clearRecords())
      dispatch(clearGridView())
    }
  }, [])

  useEffect(() => {
    if (listId !== undefined && isNumber(+listId)) {
      appDispatch(fetchListById(listId)).then((res) => {
        const listElementId = res?.payload?.appElement?.id
        const linkCustomFields = res?.payload?.customFields?.native?.fields.filter(
          (i) => +i.baseType === customFieldBaseTypes.SingleLink || +i.baseType === customFieldBaseTypes.Link,
        )
        linkCustomFields?.map((customField) => {
          const isBaseList = +customField.appElementId === +listElementId
          const optionsListListId = isBaseList ? customField.intermediateAppElementId : customField.appElementId
          dispatch(getListLinkOptions(+optionsListListId))
        })
      })
      appDispatch(fetchUsersByListId({ listId: listId }))
    }
  }, [listId])

  useEffect(() => {
    if (listId !== undefined && isNumber(+listId)) appDispatch(fetchGridViewsByListId(listId))
  }, [appDispatch, listId])

  useEffect(() => {
    appDispatch(clearFilters())
    if (currentViewType === 'grid' && listId !== undefined && isNumber(+listId)) {
      appDispatch(fetchGridViewsByListId(listId))
      if (isArchived) {
        onArchive()
      }
    }
  }, [appDispatch, listId, currentViewType])

  useEffect(() => {
    if (recordIdFromUrl) {
      dispatch(setCurrentRecord(recordIdFromUrl))
      setPanelContent({
        content: (
          <AddRecordToListForm
            isAdmin={isAdmin && !list?.appElement?.isArchived}
            isEditor={isEditor && !list?.appElement?.isArchived}
            listId={+listId}
            partialRecord={state?.partialRecord}
            recordId={+recordIdFromUrl}
          />
        ),
        header: recordIdFromUrl === 'undefined' && `${t('common:labels.createRecord')}`,
        isBig: true,
      })
      openPanel()
    } else if (isPanelOpen && isEditor)
      setPanelContent({
        content: (
          <AddRecordToListForm
            isAdmin={isAdmin && !list?.appElement?.isArchived}
            isEditor={isEditor && !list?.appElement?.isArchived}
            listId={+listId}
            partialRecord={state?.partialRecord}
            recordId={+recordIdFromUrl}
          />
        ),
        header: recordIdFromUrl === 'undefined' && `${t('common:labels.createRecord')}`,
        isBig: true,
      })
  }, [recordIdFromUrl, isEditor])

  const gridViewTypes = useMemo(() => {
    if (typeof gridViews === 'string') return []
    return gridViews?.map(({ id }) => ({
      Icon: GridIcon,
      requirePremium: false,
      text: t('labels.grid'),
      url: `grid/${id}`,
    }))
  }, [gridViews, t])

  const viewTypes: SingleViewTypeType[] = useMemo(
    () => [
      {
        Icon: KanbanIcon,
        requirePremium: false,
        text: t('labels.kanban'),
        url: 'kanban',
      },
      ...gridViewTypes,
      {
        Icon: CalendarAgendaIcon,
        requirePremium: false,
        text: t('labels.agenda'),
        url: 'agenda',
      },
      {
        Icon: CalendarCardIcon,
        requirePremium: true,
        text: t('labels.calendar'),
        url: 'calendar',
      },
      {
        Icon: TimelineIcon,
        requirePremium: true,
        text: t('labels.timeline'),
        url: 'timeline',
      },
      // TODO: add those tabs back after MVP
      // {
      //   Icon: GanttIcon,
      //   text: t('labels.gantt'),
      //   url: 'gantt',
      //   requirePremium: true
      // },
    ],
    [t, gridViewTypes.length],
  )

  const { text } = useMemo(
    () =>
      viewTypes.find(({ url }) => {
        if (currentViewTypeId) return url === `${currentViewType}/${currentViewTypeId}`
        return url === currentViewType
      }) || viewTypes[0],
    [viewTypes, currentViewTypeId, currentViewType],
  )

  const canBeFiltered = currentViewType === 'grid' || currentViewType === 'kanban'
  const isKanbanView = currentViewType === 'kanban'

  if (currentListLoading) {
    return <Loader loaderClasses="w-full flex items-center justify-center h-full" svgClasses="w-12" />
  }
  const generateDocumentContent = async () => {
    setIsSubmitting(true)
    setAnimatingRobot(true)
    const body = {
      messages: [
        {
          content:
            "You are a helpful assistant for a website called Mohimmatech, people will ask you to create tasks for them in Mohimmatech. The tasks in Mohimmatech have this format, you will abide completely to this format in your responses: {'name': 'This is a sample name','description': 'This is a sample description','priority': 5,'startDate': '2023-02-01T21:00:00.000Z','endDate': '2023-02-04T21:00:00.000Z','ownerId': 'mohammad_tashkandi@hotmail.com'}. The prioriy should be a number from 0 to 4 where 4 is the highest priority. If someone asks you to do something other than create tasks respond with 'ERROR: I apologize, but I am not able to do that for you, but i'll be happy to create some tasks for you!'",
          role: 'system',
        },
        {
          content:
            'I have a project for developing the frontend for a delivery application, create 3 tasks for me to get started',
          role: 'user',
        },
        {
          content:
            '[{"name": "Develop the home page","description": "Develop the home page according to the designs provided by our designer","priority": 2,"startDate": "2023-03-01T21:00:00.000Z","endDate": "2023-03-07T21:00:00.000Z","ownerId": "mohammad_tashkandi@hotmail.com"},{"name": "Add items to cart","description": "Allow the user to add items to his cart and edit them","priority": 0,"startDate": "2023-03-05T21:00:00.000Z","endDate": "2023-03-15T21:00:00.000Z","ownerId": "khalid@hotmail.com"},{"name": "Accept payments","description": "We should integrate with a payment gateway to accept payments from the user","priority": 4,"startDate": "2023-03-22T21:00:00.000Z","endDate": "2023-03-30T21:00:00.000Z","ownerId": "rwaida@hotmail.com"}]',
          role: 'system',
        },
        {
          content: `${chatQuestion}. The emails you can use for ownerId are: mohammad@mohimma.tech, rwaida@mohimma.tech, hassan@mohimma.tech. Don't respond as if this is a conversation`,
          role: 'user',
        },
      ],
      model: 'gpt-3.5-turbo',
    }
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
        //TODO: fix response structure , do loop and then send to create record endpoint
        //  appDispatch(createRecord({ ...recordData }))
        setToggleTippy(false)
        setIsSubmitting(false)
        setAnimatingRobot(false)
      })
  }
  return (
    <>
      <ListToolbar>
        <div className="flex flex-wrap items-center justify-between flex-1">
          <div className="flex flex-1" id="list-view-toolbar">
            <button
              className={classnames(
                'flex flex-shrink-0 items-center p-2 rounded-sm transition hover:text-primary focus:outline-none focus-visible:shadow-focus',
                {
                  'bg-tertiary-light text-tertiary-light bg-opacity-5': isSidePanelVisible,
                },
              )}
              onClick={() => setIsSidePanelVisible(!isSidePanelVisible)}>
              <ViewsIcon className="w-5 md:w-6 me-1" /> {text}
            </button>
            {isKanbanView && (
              <div className="flex items-center ms-2 md:ms-4">
                <StackBy />
              </div>
            )}
            {canBeFiltered && !isArchived && (
              <div className="flex items-center border-gray-200 ms-2 md:ms-4 border-s-2 ps-2 md:ps-4">
                <RecordFilters />
              </div>
            )}
          </div>
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
          <div className="flex justify-end" id={'archive-icon'}>
            <button
              className={classnames(
                'ms-2 md:ms-4 flex items-center p-2 rounded-sm transition hover:text-primary focus:outline-none focus-visible:shadow-focus',
                {
                  'bg-tertiary-light text-tertiary-light bg-opacity-5': isArchived,
                },
              )}
              onClick={() => {
                setIsArchived(!isArchived)
                onArchive(!isArchived)
              }}>
              <ArchiveIcon className="w-6 md:w-6 me-1" /> {t('records:archivedRecords')}
            </button>
          </div>
        </div>
      </ListToolbar>
      <div className="flex flex-1 min-h-0">
        {isSidePanelVisible && (
          <div
            className="z-10 flex flex-col justify-between flex-shrink-0 w-40 h-full text-sm bg-white border-t-2 px-2.5 py-1.5 shadow-sm"
            data-tut="sixth__step">
            <div>
              {viewTypes.map(({ Icon, text, url, requirePremium }) =>
                (isPremiumPlan && requirePremium) || !requirePremium ? (
                  <NavLink
                    key={`${text} - ${url} - ${isRtl}`}
                    activeClassName="bg-tertiary-light text-tertiary-light"
                    className="flex items-center p-2 my-2 rounded-sm bg-opacity-5 transition transition-colors hover:text-primary focus:outline-none focus-visible:shadow-focus"
                    to={`${urlBase}/${url}`}>
                    <Icon className="w-5 md:w-6 me-1" /> {text}
                  </NavLink>
                ) : null,
              )}
            </div>
            <div>
              <NavLink
                activeClassName="bg-tertiary-light text-tertiary-light"
                className="flex items-center p-2 mt-2 mb-4 rounded-sm bg-opacity-5 transition transition-colors hover:text-primary focus:outline-none focus-visible:shadow-focus"
                to={`${urlBase}/details`}>
                <SettingsIcon className="w-5 md:w-6 me-1" /> {t('labels.listSettings')}
              </NavLink>
            </div>
          </div>
        )}
        <Switch key={listId}>
          <Route path="/workspace/:workspaceId/stations/:stationId/lists/:listId/grid/:viewTypeId?">
            <RecordsListingPage isArchived={isArchived} />
          </Route>
          <Route path="/workspace/:workspaceId/stations/:stationId/lists/:listId/kanban">
            <KanbanViewPage isArchived={isArchived} />
          </Route>
          <Route
            path={[
              '/workspace/:workspaceId/stations/:stationId/lists/:listId/details',
              '/workspace/:workspaceId/stations/:stationId/lists/:listId/users',
              '/workspace/:workspaceId/stations/:stationId/lists/:listId/fields',
            ]}>
            <ListSettingsPage />
          </Route>
          <Route path="/workspace/:workspaceId/stations/:stationId/lists/:listId/agenda">
            <CalendarAgendaView />
          </Route>
          {isPremiumPlan && (
            <>
              <Route path="/workspace/:workspaceId/stations/:stationId/lists/:listId/calendar">
                <Calendar />
              </Route>
              <Route path="/workspace/:workspaceId/stations/:stationId/lists/:listId/timeline">
                <Timeline />
              </Route>
              <Route path="/workspace/:workspaceId/stations/:stationId/lists/:listId/gantt">
                <div>Gantt</div>
              </Route>
            </>
          )}
        </Switch>
      </div>
    </>
  )
}

export default AutoCreateTasks
