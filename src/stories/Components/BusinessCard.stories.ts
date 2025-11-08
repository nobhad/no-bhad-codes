import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Business Card',
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    isFlipped: {
      control: 'boolean',
      description: 'Show back of card'
    }
  },
  args: {
    isFlipped: false
  }
};

export default meta;
type Story = StoryObj;

const createBusinessCard = (args: any) => {
  const { isFlipped } = args;

  return `
    <div class="business-card-container">
      <div id="business-card" class="business-card${isFlipped ? ' flipped' : ''}">
        <div id="business-card-inner" class="business-card-inner${isFlipped ? ' flipped' : ''}">
          <div class="business-card-front">
            <img src="/images/business-card_front.svg" alt="Business Card Front" class="card-svg" width="525" height="299.7">
          </div>
          <div class="business-card-back">
            <img src="/images/business-card_back.svg" alt="Business Card Back" class="card-svg" width="525" height="299.7">
          </div>
        </div>
      </div>
    </div>
    
    <style>
      /* Ensure flip animation works in Storybook */
      .business-card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.6s ease-in-out;
      }
      
      .business-card-inner.flipped {
        transform: rotateY(180deg);
      }
      
      .business-card-front,
      .business-card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      
      .business-card-front {
        z-index: 2;
        transform: rotateY(0deg);
      }
      
      .business-card-back {
        transform: rotateY(180deg);
      }
      
      .card-svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    </style>
  `;
};

export const Front: Story = {
  render: createBusinessCard
};

export const Back: Story = {
  args: {
    isFlipped: true
  },
  render: createBusinessCard
};

export const InSection: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => `
    <section id="intro" class="business-card-section">
      <div class="business-card-container">
        <div id="business-card" class="business-card">
          <div id="business-card-inner" class="business-card-inner">
            <div class="business-card-front">
              <img src="/images/business-card_front.svg" alt="Business Card Front" class="card-svg" width="525" height="299.7">
            </div>
            <div class="business-card-back">
              <img src="/images/business-card_back.svg" alt="Business Card Back" class="card-svg" width="525" height="299.7">
            </div>
          </div>
        </div>
      </div>
    </section>
  `
};

export const Interactive: Story = {
  parameters: {
    layout: 'centered'
  },
  render: () => `
    <div>
      <div style="text-align: center; margin-bottom: 1rem;">
        <p><strong>Click the card to flip it!</strong></p>
      </div>
      
      <div class="business-card-container">
        <div id="interactive-card" class="business-card" onclick="flipCard()" style="cursor: pointer;">
          <div id="interactive-inner" class="business-card-inner">
            <div class="business-card-front">
              <img src="/images/business-card_front.svg" alt="Business Card Front" class="card-svg" width="525" height="299.7">
            </div>
            <div class="business-card-back">
              <img src="/images/business-card_back.svg" alt="Business Card Back" class="card-svg" width="525" height="299.7">
            </div>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <p id="card-status" style="font-weight: 500;">Showing: Front</p>
      </div>
    </div>
    
    <style>
      .business-card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.6s ease-in-out;
      }
      
      .business-card-inner.flipped {
        transform: rotateY(180deg);
      }
      
      .business-card-front,
      .business-card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      
      .business-card-front {
        z-index: 2;
        transform: rotateY(0deg);
      }
      
      .business-card-back {
        transform: rotateY(180deg);
      }
      
      .card-svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      
      .business-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      }
    </style>
    
    <script>
      let isFlipped = false;
      
      function flipCard() {
        isFlipped = !isFlipped;
        const inner = document.getElementById('interactive-inner');
        const status = document.getElementById('card-status');
        
        if (isFlipped) {
          inner.classList.add('flipped');
          status.textContent = 'Showing: Back';
        } else {
          inner.classList.remove('flipped');
          status.textContent = 'Showing: Front';
        }
        
        // Trigger Storybook action
        window.__STORYBOOK_ADDONS_CHANNEL__ && window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
          name: 'business-card-flipped',
          args: [{ 
            isFlipped: isFlipped, 
            showing: isFlipped ? 'back' : 'front' 
          }]
        });
      }
    </script>
  `
};