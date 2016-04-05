import AppConstants from '../AppConstants';
// Example state tree:
// [
//{
//    "id": "NkgjBKgCx",
//    "data": "{\"ref_type\":\"branch\",\"ref\":\"helloworld\",\"user_id\":\"NysSbasYe\"}",
//    "template": "GITHUB_CREATE",
//    "created_at": "2016-03-27T08:14:55.000Z",
//    "updated_at": "2016-03-27T08:14:55.000Z",
//    "project_id": "4yGslGste"
//},
//{
//    "id": "4JPGvKe0e",
//    "data": "{\"user_id\":\"NysSbasYe\",\"commitSize\":2}",
//    "template": "GITHUB_PUSH",
//    "created_at": "2016-03-27T08:21:10.000Z",
//    "updated_at": "2016-03-27T08:21:10.000Z",
//    "project_id": "Ny2XGGjKl"
//}
// ]
export default function newsfeed(state=[], action) {
    switch (action.type) {
        case AppConstants.ADD_EVENT:
            let eventsToAdd = []
            // check for duplicates
            for (let i=0; i<action.events.length; ++i) {
                let matchingEvents = state.filter(event => event.id === action.events[i].id)
                if (matchingEvents.length === 0) {
                    eventsToAdd.push(action.events[i])
                }
            }
            return [...state, ...eventsToAdd]
        default:
            return state;
    }
}