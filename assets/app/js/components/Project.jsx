import React, { Component, PropTypes } from 'react'
import ReactTabs from 'react-tabs'
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions/ReduxTaskActions';
import _ from 'lodash'
import $ from 'jquery'
import ProjectHeader from './ProjectHeader.jsx'
import MilestoneRow from './MilestoneRow.jsx'
import CompletedRow from './CompletedRow.jsx'
import MilestoneView from './MilestoneView.jsx'
import Settings from './Settings.jsx'
import {isProjectPresent} from '../utils/collection'

const Tab = ReactTabs.Tab;
const Tabs = ReactTabs.Tabs;
const TabList = ReactTabs.TabList;
const TabPanel = ReactTabs.TabPanel;

class Project extends Component {
    constructor(props, context) {
        super(props, context); 
    }

    getMilestoneIds(milestones) {
        let ids = [];
        milestones.forEach(milestone => ids.push(milestone.id));
        return ids;
    }

    isItemPresent(arr, id) {
        return arr.indexOf(id) >= 0;
    }

    render() {   
        const {alerts, milestones, projects, tasks, users, dispatch} = this.props;        
        const actions = bindActionCreators(Actions, dispatch);
        const currentProjectId = this.props.params.id;

        let projectName = '';
        let basicUsers = [];
        let pendingUsers = [];
        let projectCreator = {};

        if (isProjectPresent(projects, currentProjectId)) {
            let currentProject = projects.filter(proj => proj.id === currentProjectId)[0];
            let basicUserIds = currentProject.basic;
            let pendingUserIds = currentProject.pending;

            projectCreator = users.filter(user  => currentProject.creator === user.id)[0];
            basicUsers = users.filter(user => this.isItemPresent(basicUserIds, user.id));
            pendingUsers = users.filter(user => this.isItemPresent(pendingUserIds, user.id));
            projectName = currentProject.content;
        } else {
            return (
                <h2>You have no projects yet!</h2>
            )
        }

        let milestonesInProj = milestones.filter(
            milestone => milestone.project_id === currentProjectId);

        let milestoneIds = this.getMilestoneIds(milestonesInProj);

        let tasksInProj = tasks.filter(
            task => this.isItemPresent(milestoneIds, task.milestone_id));

        return (
            <div className='task-table'>
                <ProjectHeader projectName={projectName}/>
                <Tabs>
                    
                    <TabList>
                        <Tab>Milestone View</Tab>
                        <Tab>Settings</Tab>
                    </TabList>

                    <TabPanel>
                        <MilestoneView 
                            milestones={milestonesInProj}
                            tasks={tasksInProj}  
                            actions={actions}
                            projectId={currentProjectId}
                        />   
                    </TabPanel>

                    <TabPanel>
                        <Settings 
                            projectName={projectName}
                            projectId={currentProjectId}                            
                            basicUsers={basicUsers}
                            pendingUsers={pendingUsers}
                            projectCreator={projectCreator}    
                            actions={actions}     
                            alerts={alerts}                                               
                        />
                    </TabPanel>
                    
                </Tabs>                        
            </div>
        );
    }
}

Project.propTypes = {
    dispatch: PropTypes.func.isRequired,    
    alerts: PropTypes.object.isRequired, 
    milestones: PropTypes.array.isRequired,    
    projects: PropTypes.array.isRequired,
    tasks: PropTypes.array.isRequired,    
    users: PropTypes.array.isRequired            
};

function mapStateToProps(state) {
    return {
        alerts: state.alerts,
        milestones: state.milestones,
        projects: state.projects,
        tasks: state.tasks,
        users: state.users        
    };
}

export default connect(mapStateToProps)(Project)