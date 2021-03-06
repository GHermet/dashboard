import * as React from 'react'
import * as Relay from 'react-relay'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {withRouter} from 'react-router'
import {
  toggleNodeSelection, clearNodeSelection, setNodeSelection, setScrollTop, setLoading,
  toggleNewRow, hideNewRow, toggleFilter,
} from '../../../actions/databrowser/ui'
import {resetDataAndUI} from '../../../actions/databrowser/shared'
import {
  setItemCount, setFilterAsync, setOrder, addNodeAsync, updateNodeAsync,
  reloadDataAsync, loadDataAsync,
} from '../../../actions/databrowser/data'
import {Popup} from '../../../types/popup'
import * as Immutable from 'immutable'
import * as PureRenderMixin from 'react-addons-pure-render-mixin'
import Icon from '../../../components/Icon/Icon'
import mapProps from '../../../components/MapProps/MapProps'
import Loading from '../../../components/Loading/Loading'
import {showNotification} from '../../../actions/notification'
import {ShowNotificationCallback, TypedValue} from '../../../types/utils'
import {stringToValue} from '../../../utils/valueparser'
import Tether from '../../../components/Tether/Tether'
import NewRow from './NewRow'
import HeaderCell from './HeaderCell'
import AddFieldCell from './AddFieldCell'
import CheckboxCell from './CheckboxCell'
import {emptyDefault, getFirstInputFieldIndex, getDefaultFieldValues, calculateFieldColumnWidths} from '../utils'
import {Field, Model, Viewer, Project, OrderBy} from '../../../types/types'
import ModelHeader from '../ModelHeader'
import {showDonePopup, nextStep} from '../../../actions/gettingStarted'
import {GettingStartedState} from '../../../types/gettingStarted'
import {showPopup, closePopup} from '../../../actions/popup'
import InfiniteTable from '../../../components/InfiniteTable/InfiniteTable'
import {AutoSizer} from 'react-virtualized'
import Cell from './Cell'
import LoadingCell from './LoadingCell'
import {getLokka, addNodes, deleteNode} from './../../../utils/relay'
import ProgressIndicator from '../../../components/ProgressIndicator/ProgressIndicator'
import {startProgress, incrementProgress} from '../../../actions/progressIndicator'
import {StateTree} from '../../../types/reducers'
import cuid from 'cuid'
const classes: any = require('./BrowserView.scss')

interface Props {
  viewer: Viewer
  router: ReactRouter.InjectedRouter
  route: any
  params: any
  fields: Field[]
  project: Project
  model: Model
  gettingStartedState: GettingStartedState
  showNotification: ShowNotificationCallback
  nextStep: () => void
  startProgress: () => any
  incrementProgress: () => any
  showPopup: (popup: Popup) => any
  closePopup: (id: string) => any
  showDonePopup: () => any
  newRowVisible: boolean
  toggleNewRow: () => any
  hideNewRow: () => any
  toggleFilter: () => any
  setScrollTop: (scrollTop: number) => any
  setLoading: (loading: boolean) => any
  resetDataAndUI: () => any
  clearNodeSelection: () => any
  setNodeSelection: (ids: Immutable.List<string>) => any
  toggleNodeSelection: (id: string) => any
  filtersVisible: boolean
  selectedNodeIds: Immutable.List<string>
  loading: boolean
  scrollTop: number
  itemCount: number
  setItemCount: (itemCount: number) => any
  filter: Immutable.Map<string, TypedValue>
  orderBy: OrderBy
  setOrder: (orderBy: OrderBy) => any
  nodes: Immutable.List<Immutable.Map<string, any>>
  loaded: Immutable.List<boolean>
  setFilterAsync: (fieldName: string, value: TypedValue, lokka: any, modelNamePlural: string, fields: Field[]) => any
  addNodeAsync: (lokka: any, model: Model, fields: Field[], fieldValues: { [key: string]: any }) => any
  updateNodeAsync: (lokka: any, model: Model, fields: Field[], value: TypedValue, field: Field, callback, nodeId: string, index: number) => any // tslint:disable-line
  reloadDataAsync: (lokka: any, modelNamePlural: string, fields: Field[], index?: number) => any
  loadDataAsync: (lokka: any, modelNamePlural: string, field: Field[], first: number, skip: number) => any
}

class BrowserView extends React.Component<Props, {}> {

  shouldComponentUpdate: any

  private lokka: any

  constructor(props: Props) {
    super(props)
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this)
    this.lokka = getLokka(this.props.project.id)
  }

  componentWillMount = () => {
    this.props.setItemCount(this.props.model.itemCount)
    this.reloadData()
  }

  componentDidMount = () => {
    analytics.track('models/browser: viewed', {
      model: this.props.params.modelName,
    })

    this.props.router.setRouteLeaveHook(this.props.route, () => {
      if (this.props.newRowVisible) {
        // TODO with custom dialogs use "return false" and display custom dialog
        if (confirm('Are you sure you want to discard unsaved changes?')) {
          this.props.resetDataAndUI()
          return true
        } else {
          return false
        }
      } else {
        this.props.resetDataAndUI()
      }
    })
  }

  componentWillUnmount = () => {
    this.props.resetDataAndUI()
  }

  render() {
    return (
      <div className={`${classes.root} ${this.props.filtersVisible ? classes.filtersVisible : ''}`}>
        <ModelHeader
          params={this.props.params}
          model={this.props.model}
          viewer={this.props.viewer}
          project={this.props.project}
        >
          <input type='file' onChange={this.handleImport} id='fileselector' className='dn'/>
          <label htmlFor='fileselector' className={classes.button}>
            Import JSON
          </label>
          {this.renderTether()}
          {this.props.selectedNodeIds.size > 0 &&
          <div className={`${classes.button} ${classes.red}`} onClick={this.deleteSelectedNodes}>
            <Icon
              width={16}
              height={16}
              src={require('assets/icons/delete.svg')}
            />
            <span>Delete Selected ({this.props.selectedNodeIds.size})</span>
          </div>
          }
          <div
            className={`${classes.button} ${this.props.filtersVisible ? classes.blue : ''}`}
            onClick={this.props.toggleFilter}
          >
            <Icon
              width={16}
              height={16}
              src={require('assets/icons/search.svg')}
            />
          </div>
          <div className={classes.button} onClick={() => this.reloadData(Math.floor(this.props.scrollTop / 47))}>
            <Icon
              width={16}
              height={16}
              src={require('assets/icons/refresh.svg')}
            />
          </div>
        </ModelHeader>
        <div className={`${classes.table} ${this.props.loading ? classes.loading : ''}`}>
          <div className={classes.tableContainer} style={{ width: '100%' }}>
            <AutoSizer>
              {({width, height}) => {
                const fieldColumnWidths = calculateFieldColumnWidths(width, this.props.fields, this.props.nodes)
                if (this.props.loading) {
                  return
                }
                return (
                  <InfiniteTable
                    loadedList={this.props.loaded}
                    minimumBatchSize={50}
                    width={this.props.fields.reduce((sum, {name}) => sum + fieldColumnWidths[name], 0) + 34 + 250}
                    height={height}
                    scrollTop={this.props.scrollTop}
                    columnCount={this.props.fields.length + 2}
                    columnWidth={(input) => this.getColumnWidth(fieldColumnWidths, input)}
                    loadMoreRows={(input) => this.loadData(input.startIndex)}
                    addNew={this.props.newRowVisible}
                    onScroll={(input) => this.props.setScrollTop(input.scrollTop)}

                    headerHeight={74}
                    headerRenderer={this.headerRenderer}

                    rowCount={this.props.itemCount}
                    rowHeight={47}
                    cellRenderer={this.cellRenderer}
                    loadingCellRenderer={this.loadingCellRenderer}

                    addRowHeight={47}
                    addCellRenderer={() => this.addCellRenderer(fieldColumnWidths)}
                  />
                )
              }}
            </AutoSizer>
          </div>
        </div>
        {this.props.loading &&
        <div className={classes.loadingOverlay}>
          <Loading color='#B9B9C8'/>
        </div>
        }
      </div>
    )
  }

  private renderTether = (): JSX.Element => {
    return (
      <Tether
        steps={[{
          step: this.props.newRowVisible ? null : 'STEP3_CLICK_ADD_NODE1',
          title: 'Create a Node',
          description: 'Items in your data belonging to a certain model are called nodes. Create a new post node and provide values for the "imageUrl" and "description" fields.', // tslint:disable-line
        }, {
          step: this.props.newRowVisible ? null : 'STEP3_CLICK_ADD_NODE2',
          title: `Awesome! Let's create one more.`,
          description: 'Hint: You can also use your keyboard to navigate between fields (Tab or Shift+Tab) and submit (Enter).', // tslint:disable-line
        }]}
        offsetX={15}
        offsetY={5}
        width={351}
        horizontal='right'
      >
        <div
          className={`${classes.button} ${this.props.newRowVisible ? '' : classes.green}`}
          onClick={this.handleAddNodeClick}
        >
          <Icon
            width={16}
            height={16}
            src={require(`assets/icons/${this.props.newRowVisible ? 'close' : 'add'}.svg`)}
          />
          <span>{this.props.newRowVisible ? 'Cancel' : 'Add node'}</span>
        </div>
      </Tether>
    )
  }

  private handleImport = (e: any) => {
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onloadend = this.parseImport
    reader.readAsText(file)
  }

  private parseImport = (e: any) => {
    const data = JSON.parse(e.target.result)
    const values = []
    data.forEach(item => {
      const fieldValues = getDefaultFieldValues(this.props.model.fields.edges.map((edge) => edge.node))
      Object.keys(item).forEach((key) => fieldValues[key].value = item[key])
      values.push(fieldValues)
    })
    const promises = []
    const chunk = 10
    const total = Math.max(1, Math.floor(values.length / chunk))
    const id = cuid()
    this.props.startProgress()
    this.props.showPopup({
      element: <ProgressIndicator title='Importing' total={total}/>,
      id,
    })
    for (let i = 0; i < total; i++) {
      promises.push(
        addNodes(this.lokka, this.props.params.modelName, values.slice(i * chunk, i * chunk + chunk))
          .then(() => this.props.incrementProgress())
      )
    }
    Promise.all(promises).then(() => this.reloadData(0)).then(() => this.props.closePopup(id))
  }

  private handleAddNodeClick = () => {
    if (this.props.gettingStartedState.isCurrentStep('STEP3_CLICK_ADD_NODE1')) {
      this.props.nextStep()
    }
    if (getFirstInputFieldIndex(this.props.fields) !== null) {
      this.props.toggleNewRow()
    } else {
      const fieldValues = this.props.model.fields.edges
        .map((edge) => edge.node)
        .filter((f) => f.name !== 'id')
        .mapToObject(
          (field) => field.name,
          (field) => ({
            value: stringToValue(field.defaultValue, field) || emptyDefault(field),
            field: field,
          })
        )
      this.addNewNode(fieldValues)
    }
  }

  private addCellRenderer = (columnWidths) => {
    return (
      <NewRow
        model={this.props.model}
        projectId={this.props.project.id}
        columnWidths={columnWidths}
        add={this.addNewNode}
        cancel={this.props.hideNewRow}
      />
    )
  }

  private loadingCellRenderer = ({rowIndex, columnIndex}) => {
    const backgroundColor = rowIndex % 2 === 0 ? '#FCFDFE' : '#FFF'
    if (columnIndex === 0) {
      return (
        <CheckboxCell
          backgroundColor={backgroundColor}
          onChange={undefined}
          disabled={true}
          checked={false}
          height={47}
        />
      )
    } else if (columnIndex === this.props.fields.length + 1) { // AddColumn
      return (
        <LoadingCell
          backgroundColor={backgroundColor}
          empty={true}
        />
      )
    } else {
      return (
        <LoadingCell
          backgroundColor={backgroundColor}
        />
      )
    }
  }

  private headerRenderer = ({columnIndex}): JSX.Element | string => {
    const {model, fields, orderBy, selectedNodeIds, nodes, params} = this.props
    if (columnIndex === 0) {
      return (
        <CheckboxCell
          height={74}
          onChange={this.selectAllOnClick}
          checked={selectedNodeIds.size === nodes.size && nodes.size > 0}
          backgroundColor={'transparent'}
        />
      )
    } else if (columnIndex === fields.length + 1) {
      return <AddFieldCell params={params}/>
    } else {
      const field = fields[columnIndex - 1]
      return (
        <HeaderCell
          key={field.id}
          field={field}
          sortOrder={orderBy.fieldName === field.name ? orderBy.order : null}
          toggleSortOrder={() => this.setSortOrder(field)}
          updateFilter={(value) => this.props.setFilterAsync(field.name, value, this.lokka, model.namePlural, fields)}
          filterVisible={this.props.filtersVisible}
          params={params}
        />
      )
    }
  }

  private cellRenderer = ({rowIndex, columnIndex}): JSX.Element | string => {
    const node = this.props.nodes.get(rowIndex)
    const nodeId = node.get('id')
    const field = this.props.fields[columnIndex - 1]
    const backgroundColor = rowIndex % 2 === 0 ? '#FCFDFE' : '#FFF'
    if (columnIndex === 0) {
      return (
        <CheckboxCell
          checked={this.isSelected(nodeId)}
          onChange={() => this.props.toggleNodeSelection(nodeId)}
          height={47}
          backgroundColor={backgroundColor}
        />
      )
    } else if (columnIndex === this.props.fields.length + 1) { // AddColumn
      return (
        <LoadingCell
          backgroundColor={backgroundColor}
          empty={true}
        />
      )
    } else {
      const value = node.get(field.name)
      return (
        <Cell
          isSelected={this.isSelected(nodeId)}
          backgroundColor={backgroundColor}
          field={field}
          value={value}
          projectId={this.props.project.id}
          update={(value, field, callback) => this.updateEditingNode(value, field, callback, nodeId, rowIndex)}
          reload={() => this.loadData(rowIndex, 1)}
          nodeId={nodeId}
        />
      )
    }
  }

  private getColumnWidth = (fieldColumnWidths, {index}): number => {
    if (index === 0) { // Checkbox
      return 34
    } else if (index === this.props.fields.length + 1) { // AddColumn
      return 250
    } else {
      return fieldColumnWidths[this.getFieldName(index - 1)]
    }
  }

  private getFieldName = (index: number): string => {
    return this.props.fields[index].name
  }

  private setSortOrder = (field: Field) => {
    const order: 'ASC' | 'DESC' = this.props.orderBy.fieldName === field.name
      ? (this.props.orderBy.order === 'ASC' ? 'DESC' : 'ASC')
      : 'ASC'

    this.props.setOrder({fieldName: field.name, order})
    this.reloadData()
  }

  private loadData = (skip: number, first: number = 50): any => {
    return this.props.loadDataAsync(this.lokka, this.props.model.namePlural, this.props.fields, skip, first)
  }

  private reloadData = (index: number = 0) => {
    this.props.reloadDataAsync(this.lokka, this.props.model.namePlural, this.props.fields, index)
  }

  private updateEditingNode = (value: TypedValue, field: Field, callback, nodeId: string, index: number) => {
    this.props.updateNodeAsync(this.lokka, this.props.model, this.props.fields, value, field, callback, nodeId, index)
  }

  private addNewNode = (fieldValues: { [key: string]: any }): any => {
    return this.props.addNodeAsync(this.lokka, this.props.model, this.props.fields, fieldValues)
  }

  private isSelected = (nodeId: string): boolean => {
    return this.props.selectedNodeIds.indexOf(nodeId) > -1
  }

  private selectAllOnClick = (checked: boolean) => {
    if (checked) {
      const selectedNodeIds = this.props.nodes.map(node => node.get('id')).toList()
      this.props.setNodeSelection(selectedNodeIds)
    } else {
      this.props.clearNodeSelection()
    }
  }

  private deleteSelectedNodes = () => {
    if (confirm(`Do you really want to delete ${this.props.selectedNodeIds.size} node(s)?`)) {
      // only reload once after all the deletions

      this.props.setLoading(true)
      Promise.all(this.props.selectedNodeIds.toArray()
        .map((nodeId) => deleteNode(this.lokka, this.props.params.modelName, nodeId)))
        .then(analytics.track('models/browser: deleted node', {
          project: this.props.params.projectName,
          model: this.props.params.modelName,
        }))
        .then(() => this.props.setLoading(false))
        .then(() => this.reloadData())
        .catch((err) => {
          err.rawError.forEach((error) => this.props.showNotification({message: error.message, level: 'error'}))
        })
      this.props.clearNodeSelection()
    }
  }
}

const mapStateToProps = (state: StateTree) => {
  return {
    gettingStartedState: state.gettingStarted.gettingStartedState,
    newRowVisible: state.databrowser.ui.newRowVisible,
    filtersVisible: state.databrowser.ui.filtersVisible,
    selectedNodeIds: state.databrowser.ui.selectedNodeIds,
    scrollTop: state.databrowser.ui.scrollTop,
    loading: state.databrowser.ui.loading,
    itemCount: state.databrowser.data.itemCount,
    filter: state.databrowser.data.filter,
    orderBy: state.databrowser.data.orderBy,
    nodes: state.databrowser.data.nodes,
    loaded: state.databrowser.data.loaded,
  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      toggleNewRow,
      hideNewRow,
      toggleFilter,
      setNodeSelection,
      clearNodeSelection,
      toggleNodeSelection,
      setScrollTop,
      setLoading,
      resetDataAndUI,
      showDonePopup,
      nextStep,
      showPopup,
      closePopup,
      startProgress,
      incrementProgress,
      showNotification,
      setItemCount,
      setFilterAsync,
      setOrder,
      addNodeAsync,
      updateNodeAsync,
      reloadDataAsync,
      loadDataAsync,
    },
    dispatch)
}

const ReduxContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(withRouter(BrowserView))

const MappedBrowserView = mapProps({
  params: (props) => props.params,
  fields: (props) => (
    props.viewer.model.fields.edges
      .map((edge) => edge.node)
  ),
  model: (props) => props.viewer.model,
  project: (props) => props.viewer.project,
  viewer: (props) => props.viewer,
})(ReduxContainer)

export default Relay.createContainer(MappedBrowserView, {
  initialVariables: {
    modelName: null, // injected from router
    projectName: null, // injected from router
  },
  fragments: {
    viewer: () => Relay.QL`
      fragment on Viewer {
        model: modelByName(projectName: $projectName, modelName: $modelName) {
          name
          namePlural
          itemCount
          fields(first: 1000) {
            edges {
              node {
                id
                name
                typeIdentifier
                isList
                isReadonly
                defaultValue
                relatedModel {
                  name
                }
                ${HeaderCell.getFragment('field')}
                ${Cell.getFragment('field')}
              }
            }
          }
          ${NewRow.getFragment('model')}
          ${ModelHeader.getFragment('model')}
        }
        project: projectByName(projectName: $projectName) {
          id
          ${ModelHeader.getFragment('project')}
        }
        ${ModelHeader.getFragment('viewer')}
      }
    `,
  },
})
