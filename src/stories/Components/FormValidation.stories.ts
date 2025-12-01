import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Form Validation',
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    formType: {
      control: 'select',
      options: ['contact', 'intake', 'simple'],
      description: 'Type of form to demonstrate'
    }
  },
  args: {
    formType: 'simple'
  }
};

export default meta;
type Story = StoryObj;

const createValidationDemo = (args: any) => {
  const { formType } = args;

  if (formType === 'simple') {
    return `
      <div style="max-width: 500px; padding: 2rem; border: 1px solid #ddd; border-radius: 8px;">
        <h3>Form Validation Demo</h3>
        <p>Fill out all required fields to see the submit button turn green!</p>
        
        <form oninput="validateDemoForm(this)">
          <div style="margin-bottom: 1rem;">
            <label for="demo-name" style="display: block; margin-bottom: 0.5rem;">Name (required)</label>
            <input 
              type="text" 
              id="demo-name" 
              name="name" 
              required 
              style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;"
              placeholder="Enter your name"
            >
          </div>
          
          <div style="margin-bottom: 1rem;">
            <label for="demo-email" style="display: block; margin-bottom: 0.5rem;">Email (required)</label>
            <input 
              type="email" 
              id="demo-email" 
              name="email" 
              required 
              style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;"
              placeholder="Enter your email"
            >
          </div>
          
          <div style="margin-bottom: 1rem;">
            <label for="demo-topic" style="display: block; margin-bottom: 0.5rem;">Topic (required)</label>
            <select 
              id="demo-topic" 
              name="topic" 
              required 
              style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;"
            >
              <option value="">Select a topic...</option>
              <option value="General">General Question</option>
              <option value="Project">New Project</option>
              <option value="Support">Support</option>
            </select>
          </div>
          
          <div style="margin-bottom: 1rem;">
            <label for="demo-message" style="display: block; margin-bottom: 0.5rem;">Message (required)</label>
            <textarea 
              id="demo-message" 
              name="message" 
              required 
              rows="4"
              style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
              placeholder="Enter your message"
            ></textarea>
          </div>
          
          <button 
            type="submit" 
            id="demo-submit" 
            style="
              background: #3b82f6; 
              color: white; 
              border: 2px solid #2563eb; 
              padding: 0.75rem 2rem; 
              border-radius: 6px; 
              cursor: pointer;
              font-weight: 600;
              transition: all 0.3s ease;
              width: 100%;
            "
            onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
              name: 'demo-form-submitted',
              args: [{ 
                formData: Object.fromEntries(new FormData(event.target.closest('form'))),
                action: 'submit-demo-form',
                isValid: event.target.closest('form').checkValidity(),
                buttonState: event.target.classList.contains('valid') ? 'green' : 'default'
              }]
            })"
          >
            Submit Form
          </button>
        </form>
        
        <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px; font-size: 0.875rem;">
          <strong>Instructions:</strong>
          <ol style="margin: 0.5rem 0 0 1rem; padding: 0;">
            <li>Start filling out the form fields</li>
            <li>Notice the button stays blue initially</li>
            <li>When ALL required fields are complete, button turns green</li>
            <li>If you clear any required field, it goes back to blue</li>
          </ol>
        </div>
        
        <script>
          function validateDemoForm(form) {
            const submitButton = form.querySelector('#demo-submit');
            const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
            
            let allValid = true;
            let fieldCount = 0;
            let filledCount = 0;
            
            requiredFields.forEach(field => {
              fieldCount++;
              if (field.value.trim()) {
                filledCount++;
              } else {
                allValid = false;
              }
            });
            
            if (allValid && fieldCount > 0) {
              submitButton.style.backgroundColor = '#10b981';
              submitButton.style.borderColor = '#059669';
              submitButton.classList.add('valid');
              submitButton.style.transform = 'translateY(-1px)';
              submitButton.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
              
              window.__STORYBOOK_ADDONS_CHANNEL__ && window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'form-validation-changed',
                args: [{ 
                  allFieldsValid: true, 
                  buttonState: 'green',
                  progress: filledCount + '/' + fieldCount + ' fields complete'
                }]
              });
            } else {
              submitButton.style.backgroundColor = '#3b82f6';
              submitButton.style.borderColor = '#2563eb';
              submitButton.classList.remove('valid');
              submitButton.style.transform = '';
              submitButton.style.boxShadow = '';
              
              window.__STORYBOOK_ADDONS_CHANNEL__ && window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'form-validation-changed',
                args: [{ 
                  allFieldsValid: false, 
                  buttonState: 'blue',
                  progress: filledCount + '/' + fieldCount + ' fields complete'
                }]
              });
            }
          }
        </script>
      </div>
    `;
  }

  return '<p>Select a form type to see validation demo</p>';
};

export const SimpleForm: Story = {
  render: createValidationDemo
};

export const ValidationStates: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; max-width: 800px;">
      <div style="padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px;">
        <h4>Invalid State (Default)</h4>
        <p>Button when required fields are missing:</p>
        <button 
          style="
            background: #3b82f6; 
            color: white; 
            border: 2px solid #2563eb; 
            padding: 0.75rem 2rem; 
            border-radius: 6px; 
            cursor: pointer;
            font-weight: 600;
            width: 100%;
          "
        >
          Submit Form
        </button>
      </div>
      
      <div style="padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px;">
        <h4>Valid State (Green)</h4>
        <p>Button when all required fields are complete:</p>
        <button 
          style="
            background: #10b981; 
            color: white; 
            border: 2px solid #059669; 
            padding: 0.75rem 2rem; 
            border-radius: 6px; 
            cursor: pointer;
            font-weight: 600;
            width: 100%;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
          "
        >
          Submit Form
        </button>
      </div>
    </div>
    
    <div style="margin-top: 2rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <strong>Form Validation Behavior:</strong>
      <ul style="margin: 0.5rem 0 0 1rem;">
        <li>Button starts with default blue background</li>
        <li>Real-time validation on every input change</li>
        <li>When all required fields are valid → Green background</li>
        <li>Maintains all other styling (border, padding, etc.)</li>
        <li>Smooth transition animation between states</li>
        <li>Subtle hover effect when valid (lifted + shadow)</li>
      </ul>
    </div>
  `
};

export const LiveDemo: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => `
    <div style="max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem;">Interactive Form Validation</h2>
        <p style="margin: 0; opacity: 0.9;">Watch the submit button change as you complete the form!</p>
      </div>
      
      <div style="background: white; padding: 2rem; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <form oninput="validateLiveForm(this)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">First Name *</label>
              <input 
                type="text" 
                name="firstName" 
                required 
                style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; transition: border-color 0.2s;"
                onfocus="this.style.borderColor='#3b82f6'"
                onblur="this.style.borderColor='#e5e7eb'"
              >
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Last Name *</label>
              <input 
                type="text" 
                name="lastName" 
                required 
                style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; transition: border-color 0.2s;"
                onfocus="this.style.borderColor='#3b82f6'"
                onblur="this.style.borderColor='#e5e7eb'"
              >
            </div>
          </div>
          
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email Address *</label>
            <input 
              type="email" 
              name="email" 
              required 
              style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; transition: border-color 0.2s;"
              onfocus="this.style.borderColor='#3b82f6'"
              onblur="this.style.borderColor='#e5e7eb'"
            >
          </div>
          
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Project Type *</label>
            <select 
              name="projectType" 
              required 
              style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; transition: border-color 0.2s;"
              onfocus="this.style.borderColor='#3b82f6'"
              onblur="this.style.borderColor='#e5e7eb'"
            >
              <option value="">Choose project type...</option>
              <option value="website">Website</option>
              <option value="webapp">Web Application</option>
              <option value="ecommerce">E-commerce</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div style="margin-bottom: 2rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Project Description *</label>
            <textarea 
              name="description" 
              required 
              rows="4"
              placeholder="Tell us about your project..."
              style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical; transition: border-color 0.2s;"
              onfocus="this.style.borderColor='#3b82f6'"
              onblur="this.style.borderColor='#e5e7eb'"
            ></textarea>
          </div>
          
          <div style="text-align: center;">
            <button 
              type="submit" 
              id="live-submit" 
              style="
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white; 
                border: none; 
                padding: 1rem 3rem; 
                border-radius: 50px; 
                cursor: pointer;
                font-weight: 600;
                font-size: 1.1rem;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
              "
              onmouseover="if(!this.classList.contains('valid')) { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)'; }"
              onmouseout="if(!this.classList.contains('valid')) { this.style.transform = ''; this.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)'; }"
              onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'live-demo-submitted',
                args: [{ 
                  formData: Object.fromEntries(new FormData(event.target.closest('form'))),
                  isComplete: event.target.classList.contains('valid')
                }]
              })"
            >
              🚀 Submit Project Request
            </button>
          </div>
        </form>
        
        <div id="form-status" style="margin-top: 1rem; text-align: center; padding: 0.5rem; border-radius: 6px; font-weight: 500; display: none;"></div>
      </div>
      
      <script>
        function validateLiveForm(form) {
          const submitButton = form.querySelector('#live-submit');
          const statusDiv = form.parentElement.querySelector('#form-status');
          const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
          
          let allValid = true;
          let fieldCount = 0;
          let filledCount = 0;
          
          requiredFields.forEach(field => {
            fieldCount++;
            if (field.value.trim()) {
              filledCount++;
            } else {
              allValid = false;
            }
          });
          
          // Update status
          statusDiv.style.display = 'block';
          statusDiv.textContent = filledCount + ' of ' + fieldCount + ' required fields complete';
          
          if (allValid && fieldCount > 0) {
            // Valid state - green
            submitButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            submitButton.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
            submitButton.style.transform = 'translateY(-2px)';
            submitButton.classList.add('valid');
            
            statusDiv.style.background = '#dcfce7';
            statusDiv.style.color = '#166534';
            statusDiv.style.border = '1px solid #bbf7d0';
            statusDiv.textContent = '✅ All fields complete - Ready to submit!';
            
          } else {
            // Invalid state - blue
            submitButton.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            submitButton.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
            submitButton.style.transform = '';
            submitButton.classList.remove('valid');
            
            statusDiv.style.background = '#fef3c7';
            statusDiv.style.color = '#92400e';
            statusDiv.style.border = '1px solid #fde68a';
          }
        }
      </script>
    </div>
  `
};
