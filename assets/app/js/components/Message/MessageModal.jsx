import React, { PropTypes, Component } from 'react';
import RaisedButton from 'material-ui/RaisedButton';
import { FormControl, FormGroup } from 'react-bootstrap';

const propTypes = {
  contentValue: PropTypes.string,
  onSubmitMethod: PropTypes.func.isRequired,
  onCloseMethod: PropTypes.func,
};
const styles = {
  textarea: {
  },
  actionButton: {
    marginTop: 5,
    marginRight: 5,
    height: 25,
  },
};
class MessageModal extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      inputText: props.contentValue || '',
    };
    this.onSubmitButtonClick = this.onSubmitButtonClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    this.setState({
      inputText: nextProps.contentValue || '',
    });
  }
  onSubmitButtonClick() {
    if (this.state.inputText.trim()) {
      this.props.onSubmitMethod(this.state.inputText);
      this.setState({ inputText: '' });
    }
  }
  handleChange(event) {
    this.setState({ inputText: event.target.value });
  }
  render() {
    return (
      <div>
        <FormGroup controlId="formControlsTextarea">
          <FormControl
            value={this.state.inputText}
            onChange={this.handleChange}
            componentClass="textarea"
            placeholder="Leave your message here!"
          />
          <RaisedButton
            disabled={!this.state.inputText.trim()}
            primary
            label="Post" onTouchTap={this.onSubmitButtonClick}
            style={styles.actionButton}
          />
          {this.props.onCloseMethod &&
            <RaisedButton
              secondary
              label="Cancel" onTouchTap={this.props.onCloseMethod}
              style={styles.actionButton}
            />
          }

        </FormGroup>
      </div>
    );
  }
}

MessageModal.propTypes = propTypes;
export default MessageModal;