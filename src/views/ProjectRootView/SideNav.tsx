import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as Relay from 'react-relay'
import {withRouter, Link} from 'react-router'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import * as PureRenderMixin from 'react-addons-pure-render-mixin'
import mapProps from '../../components/MapProps/MapProps'
import {validateModelName} from '../../utils/nameValidator'
import ScrollBox from '../../components/ScrollBox/ScrollBox'
import Icon from '../../components/Icon/Icon'
import Tether from '../../components/Tether/Tether'
import AddModelMutation from '../../mutations/AddModelMutation'
import {sideNavSyncer} from '../../utils/sideNavSyncer'
import {onFailureShowNotification} from '../../utils/relay'
import {nextStep, showDonePopup} from '../../actions/gettingStarted'
import {showPopup} from '../../actions/popup'
import {Project, Viewer, Model} from '../../types/types'
import {ShowNotificationCallback} from '../../types/utils'
import {showNotification} from '../../actions/notification'
import {Popup} from '../../types/popup'
import {GettingStartedState} from '../../types/gettingStarted'
import {classnames} from '../../utils/classnames'

const classes: any = require('./SideNav.scss')

interface Props {
  params: any
  project: Project
  projectCount: number
  viewer: Viewer
  relay: Relay.RelayProp
  models: Model[]
  gettingStartedState: GettingStartedState
  nextStep: () => Promise<any>
  skip: () => Promise<any>
  showNotification: ShowNotificationCallback
  router: ReactRouter.InjectedRouter
  showDonePopup: () => void
  showPopup: (popup: Popup) => void
}

interface State {
  forceShowModels: boolean
  addingNewModel: boolean
  newModelName: string
  newModelIsValid: boolean
}

export class SideNav extends React.Component<Props, State> {

  refs: {
    [key: string]: any;
    newModelInput: HTMLInputElement
  }

  shouldComponentUpdate: any

  constructor(props) {
    super(props)
    this.state = {
      forceShowModels: false,
      addingNewModel: false,
      newModelName: '',
      newModelIsValid: true,
    }
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this)
  }

  componentDidMount() {
    // subscribe to sideNavSyncer - THIS IS A HACK
    sideNavSyncer.setCallback(this.fetch, this)
  }

  componentWillUnmount() {
    // unsubscribe from sideNavSyncer - THIS IS A HACK
    sideNavSyncer.setCallback(null, null)
  }

  render() {

    return (
      <div
        className={classes.root}
        onMouseLeave={() => this.setState({forceShowModels: false} as State)}>
        <div className={classes.container}>
          <ScrollBox>
            {this.renderModels()}
            {this.renderRelations()}
            {this.renderActions()}
            {this.renderPlayground()}
          </ScrollBox>
        </div>
        <Link className={classes.foot} to={`/${this.props.project.name}/settings`}>
          <Icon
            width={20} height={20}
            src={require('assets/icons/gear.svg')}
          />
          <span>Project Settings</span>
        </Link>
      </div>
    )
  }

  private renderPlayground = () => {
    const playgroundPageActive = this.props.router.isActive(`/${this.props.params.projectName}/playground`)
    const showGettingStartedOnboardingPopup = () => {
      if (this.props.gettingStartedState.isCurrentStep('STEP4_CLICK_PLAYGROUND')) {
        this.props.nextStep()
      }
    }

    return (
      <div className={`${classes.listBlock} ${playgroundPageActive ? classes.active : ''}`}>
          <Link
            to={`/${this.props.params.projectName}/playground`}
            className={`${classes.head} ${playgroundPageActive ? classes.active : ''}`}
            onClick={showGettingStartedOnboardingPopup}
          >
            <Icon width={19} height={19} src={require('assets/icons/play.svg')}/>
            <Tether
              steps={[{
                step: 'STEP4_CLICK_PLAYGROUND',
                title: 'Open the Playground',
                description: 'Now that we have defined our data model and added example data it\'s time to send some queries to our backend!', // tslint:disable-line
              }]}
              offsetY={this.state.addingNewModel ? -75 : -5}
              width={280}
            >
              <span>Playground</span>
            </Tether>
          </Link>
      </div>
    )
  }

  private renderActions = () => {
    const actionsPageActive = this.props.router.isActive(`/${this.props.params.projectName}/actions`)
    return (
      <div className={`${classes.listBlock} ${actionsPageActive ? classes.active : ''}`}>
        <Link
          to={`/${this.props.params.projectName}/actions`}
          className={`${classes.head} ${actionsPageActive ? classes.active : ''}`}
        >
          <Icon width={19} height={19} src={require('assets/icons/flash.svg')}/>
          <span>Actions</span>
        </Link>
      </div>
    )
  }

  private renderRelations = () => {
    const relationsPageActive = this.props.router.isActive(`/${this.props.params.projectName}/relations`)
    return (
      <div className={`${classes.listBlock} ${relationsPageActive ? classes.active : ''}`}>
        <Link
          to={`/${this.props.params.projectName}/relations`}
          className={`${classes.head} ${relationsPageActive ? classes.active : ''}`}
        >
          <Icon width={19} height={19} src={require('assets/new_icons/relation-arrows.svg')}/>
          <span>Relations</span>
        </Link>
      </div>
    )
  }

  private renderModels = () => {
    const modelActive = (model) => (
      this.props.router.isActive(`/${this.props.params.projectName}/models/${model.name}/structure`) ||
      this.props.router.isActive(`/${this.props.params.projectName}/models/${model.name}/browser`)
    )

    const modelsPageActive = this.props.router.isActive(`/${this.props.params.projectName}/models`)
    const showsModels = modelsPageActive || this.state.forceShowModels

    return (
      <div className={`${classes.listBlock} ${showsModels ? classes.active : ''}`}>
        <Link
          to={`/${this.props.params.projectName}/models`}
          className={`${classes.head} ${modelsPageActive ? classes.active : ''}`}
        >
          <Icon width={19} height={19} src={require('assets/icons/model.svg')}/>
          <span>Models</span>
        </Link>
        <div className={`${classes.list} ${showsModels ? classes.active : classes.inactive}`}>
          {this.props.models &&
          this.props.models.map((model) => (
            <Link
              key={model.name}
              to={`/${this.props.params.projectName}/models/${model.name}`}
              className={`${classes.listElement} ${modelActive(model) ? classes.active : ''}`}
            >
              {model.name}
              <span className={classes.itemCount}>{model.itemCount}</span>
            </Link>
          ))}
        </div>
        <div className={classnames(classes.separator, this.state.addingNewModel ? '' : classes.notToggled)}>
          {this.props.models.length > 3 && !showsModels &&
          <div
            className={classes.listElement}
            onClick={() => this.setState({forceShowModels: true} as State)}
          >
            ...
          </div>
          }
          <div className={classnames(classes.newModelContainer, this.state.addingNewModel ? '' : classes.notToggled)}>
            <input
              ref='newModelInput'
              disabled={!this.state.addingNewModel}
              className={classnames(
                this.state.newModelIsValid ? '' : classes.invalid,
                classes.newModelBox,
                this.state.addingNewModel ? '' : classes.notToggled
              )}
              value={this.state.newModelName}
              onChange={this.handleNewModelChange}
              onKeyDown={this.handleNewModelKeyDown}
            />
          </div>
        </div>
        <div
          className={classnames(classes.add, this.state.addingNewModel ? classes.addActive : '')}
          onClick={this.toggleAddModelInput}
        >
          <Tether
            steps={[{
              step: 'STEP1_CREATE_POST_MODEL',
              title: 'Create a "Post" Model',
              description: 'Models represent a certain type of data. To manage our Instagram posts, the "Post" model will have an image URL and a description.', // tslint:disable-line
            }]}
            offsetY={this.state.addingNewModel ? -75 : -5}
            width={350}
          >
            <div>+ Add model</div>
          </Tether>
        </div>
      </div>
    )
  }

  private handleNewModelChange = (e) => {
    this.setState({
      newModelName: e.target.value,
      newModelIsValid: e.target.value === '' ? true : validateModelName(e.target.value),
    } as State)
  }

  private handleNewModelKeyDown = (e) => {
    if (e.keyCode === 13) {
      this.addModel()
    }
  }

  private fetch = () => {
    // the backend might cache the force fetch requests, resulting in potentially inconsistent responses
    this.props.relay.forceFetch()
  }

  private toggleAddModelInput = () => {
    if (this.state.addingNewModel && this.state.newModelIsValid) {
      this.addModel()
    }

    this.setState(
      {
        addingNewModel: !this.state.addingNewModel,
      } as State,
      () => {
        if (this.state.addingNewModel) {
          ReactDOM.findDOMNode<HTMLInputElement>(this.refs.newModelInput).focus()
        }
      }
    )
  }

  private addModel = () => {
    const redirect = () => {
      this.props.router.push(`/${this.props.params.projectName}/models/${this.state.newModelName}`)
      this.setState({
        addingNewModel: false,
        newModelIsValid: true,
        newModelName: '',
      } as State)
    }

    if (this.state.newModelName) {
      Relay.Store.commitUpdate(
        new AddModelMutation({
          modelName: this.state.newModelName,
          projectId: this.props.project.id,
        }),
        {
          onSuccess: () => {
            analytics.track('sidenav: created model', {
              project: this.props.params.projectName,
              model: this.state.newModelName,
            })
            // getting-started onboarding step
            if (
              this.state.newModelName === 'Post' &&
              this.props.gettingStartedState.isCurrentStep('STEP1_CREATE_POST_MODEL')
            ) {
              this.props.showDonePopup()
              this.props.nextStep().then(redirect)
            } else {
              redirect()
            }
          },
          onFailure: (transaction) => {
            onFailureShowNotification(transaction, this.props.showNotification)
          },
        }
      )
    }
  }
}

const mapStateToProps = (state) => {
  return {
    gettingStartedState: state.gettingStarted.gettingStartedState,
  }
}

const mapDispatchToProps = (dispatch) => {
  return bindActionCreators({nextStep, showDonePopup, showNotification, showPopup}, dispatch)
}

const ReduxContainer = connect(
  mapStateToProps,
  mapDispatchToProps,
)(withRouter(SideNav))

const MappedSideNav = mapProps({
  params: (props) => props.params,
  project: (props) => props.project,
  relay: (props) => props.relay,
  models: (props) => props.project.models.edges
    .map((edge) => edge.node)
    .sort((a, b) => a.name.localeCompare(b.name)),
})(ReduxContainer)

export default Relay.createContainer(MappedSideNav, {
  fragments: {
    viewer: () => Relay.QL`
      fragment on Viewer {
        user {
          id
        }
      }
    `,
    project: () => Relay.QL`
      fragment on Project {
        id
        name
        webhookUrl
        models(first: 100) {
          edges {
            node {
              id
              name
              itemCount
            }
          }
        }
      }
    `,
  },
})
