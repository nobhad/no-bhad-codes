/**
 * ===============================================
 * EMBED PUBLIC ROUTES
 * ===============================================
 * @file server/routes/embed/public.ts
 *
 * Public endpoints serving widget JavaScript and data.
 * No authentication required — rate-limited.
 *
 * GET    /contact-form.js    — Contact form widget script
 * GET    /testimonials.js    — Testimonial carousel script
 * GET    /status-badge.js    — Status badge widget script
 * GET    /status/:token      — Project status JSON
 */

import { Router, Response, Request } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { embedService } from '../../services/embed-service.js';
import { feedbackService } from '../../services/feedback-service.js';
import { getBaseUrl } from '../../config/environment.js';

const router = Router();

const CACHE_MAX_AGE = 300; // 5 minutes

/**
 * GET /api/embed/contact-form.js
 * Returns self-contained JavaScript for a contact form widget.
 */
router.get(
  '/contact-form.js',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).type('text/plain').send('// Missing token parameter');
      return;
    }

    const config = await embedService.getByToken(token);
    if (!config) {
      res.status(404).type('text/plain').send('// Widget not found');
      return;
    }

    const apiUrl = getBaseUrl();
    const widgetConfig = config.config as Record<string, unknown>;
    const brandColor = (widgetConfig.brandColor as string) || '#1a1a2e';
    const successMessage = (widgetConfig.successMessage as string) || 'Thank you! We will be in touch.';
    const showCompany = widgetConfig.showCompanyField !== false;
    const showSubject = widgetConfig.showSubjectField !== false;

    const script = buildContactFormScript(apiUrl, brandColor, successMessage, showCompany, showSubject);
    res.set('Content-Type', 'application/javascript');
    res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    res.send(script);
  })
);

/**
 * GET /api/embed/testimonials.js
 * Returns self-contained JavaScript for a testimonial widget.
 */
router.get(
  '/testimonials.js',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).type('text/plain').send('// Missing token parameter');
      return;
    }

    const config = await embedService.getByToken(token);
    if (!config) {
      res.status(404).type('text/plain').send('// Widget not found');
      return;
    }

    // Fetch published testimonials
    const testimonials = await feedbackService.getPublicTestimonials();

    const widgetConfig = config.config as Record<string, unknown>;
    const maxItems = (widgetConfig.maxItems as number) || 6;
    const layout = (widgetConfig.layout as string) || 'carousel';
    const showRating = widgetConfig.showRating !== false;
    const autoRotate = (widgetConfig.autoRotateSeconds as number) || 5;

    const limited = testimonials.slice(0, maxItems);

    const script = buildTestimonialScript(limited, layout, showRating, autoRotate);
    res.set('Content-Type', 'application/javascript');
    res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    res.send(script);
  })
);

/**
 * GET /api/embed/status-badge.js
 * Returns self-contained JavaScript for a project status badge.
 */
router.get(
  '/status-badge.js',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).type('text/plain').send('// Missing token parameter');
      return;
    }

    const statusInfo = await embedService.getProjectStatus(token);
    if (!statusInfo) {
      res.status(404).type('text/plain').send('// Project not found');
      return;
    }

    const script = buildStatusBadgeScript(statusInfo);
    res.set('Content-Type', 'application/javascript');
    res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    res.send(script);
  })
);

/**
 * GET /api/embed/status/:token
 * Returns project status JSON (for AJAX consumers).
 */
router.get(
  '/status/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const statusInfo = await embedService.getProjectStatus(req.params.token);

    if (!statusInfo) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE}`);
    res.json({ data: statusInfo });
  })
);

// ============================================
// Script Builders
// ============================================

function buildContactFormScript(
  apiUrl: string,
  brandColor: string,
  successMessage: string,
  showCompany: boolean,
  showSubject: boolean
): string {
  return `(function(){
  var s=document.currentScript;
  var c=document.createElement('div');
  c.id='embed-contact-form';
  s.parentNode.insertBefore(c,s.nextSibling);
  var fields=[
    {n:'name',l:'Name',t:'text',r:true},
    {n:'email',l:'Email',t:'email',r:true}
  ];
  ${showCompany ? 'fields.push({n:\'company\',l:\'Company\',t:\'text\',r:false});' : ''}
  ${showSubject ? 'fields.push({n:\'subject\',l:\'Subject\',t:\'text\',r:false});' : ''}
  fields.push({n:'message',l:'Message',t:'textarea',r:true});
  var h='<form style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:500px;">';
  fields.forEach(function(f){
    h+='<div style="margin-bottom:12px;">';
    h+='<label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">'+f.l+(f.r?' *':'')+'</label>';
    if(f.t==='textarea'){
      h+='<textarea name="'+f.n+'" rows="4" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:14px;box-sizing:border-box;"'+(f.r?' required':'')+' ></textarea>';
    }else{
      h+='<input name="'+f.n+'" type="'+f.t+'" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:14px;box-sizing:border-box;"'+(f.r?' required':'')+' />';
    }
    h+='</div>';
  });
  h+='<button type="submit" style="padding:10px 24px;background:${brandColor};color:#fff;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer;">Send</button>';
  h+='</form>';
  c.innerHTML=h;
  var form=c.querySelector('form');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var d={};
    fields.forEach(function(f){
      var el=form.querySelector('[name="'+f.n+'"]');
      d[f.n]=el?el.value:'';
    });
    var btn=form.querySelector('button');
    btn.disabled=true;btn.textContent='Sending...';
    fetch('${apiUrl}/api/intake',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(d)
    }).then(function(r){
      if(r.ok){
        c.innerHTML='<p style="font-family:-apple-system,sans-serif;color:#333;font-size:16px;">${successMessage}</p>';
      }else{
        btn.disabled=false;btn.textContent='Send';
        alert('Something went wrong. Please try again.');
      }
    }).catch(function(){
      btn.disabled=false;btn.textContent='Send';
      alert('Network error. Please try again.');
    });
  });
})();`;
}

function buildTestimonialScript(
  testimonials: Array<{ client_name: string; text: string; rating: number | null; company_name: string | null }>,
  layout: string,
  showRating: boolean,
  autoRotate: number
): string {
  const items = JSON.stringify(testimonials.map(t => ({
    n: t.client_name,
    t: t.text,
    r: t.rating,
    c: t.company_name
  })));

  return `(function(){
  var s=document.currentScript;
  var c=document.createElement('div');
  c.id='embed-testimonials';
  s.parentNode.insertBefore(c,s.nextSibling);
  var items=${items};
  if(!items.length){c.innerHTML='<p style="font-family:-apple-system,sans-serif;color:#999;">No testimonials yet.</p>';return;}
  var idx=0;
  function stars(r){
    if(!r||!${showRating})return '';
    var s='';for(var i=0;i<5;i++)s+=(i<r?'\\u2605':'\\u2606');
    return '<div style="color:#f5a623;font-size:16px;margin-bottom:6px;">'+s+'</div>';
  }
  function renderItem(item){
    return '<div style="padding:20px;border:1px solid #e8e8e8;border-radius:8px;background:#fafafa;font-family:-apple-system,sans-serif;">'
      +stars(item.r)
      +'<p style="font-size:15px;color:#333;line-height:1.5;margin:0 0 12px;">"'+item.t.replace(/"/g,'&quot;')+'"</p>'
      +'<div style="font-size:13px;font-weight:600;color:#555;">'+item.n+(item.c?' — '+item.c:'')+'</div>'
      +'</div>';
  }
  var layout='${layout}';
  if(layout==='grid'){
    var h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">';
    items.forEach(function(item){h+=renderItem(item);});
    h+='</div>';c.innerHTML=h;
  }else if(layout==='list'){
    var h='<div style="display:flex;flex-direction:column;gap:12px;">';
    items.forEach(function(item){h+=renderItem(item);});
    h+='</div>';c.innerHTML=h;
  }else{
    c.innerHTML=renderItem(items[0]);
    if(items.length>1){
      setInterval(function(){
        idx=(idx+1)%items.length;
        c.innerHTML=renderItem(items[idx]);
      },${autoRotate}*1000);
    }
  }
})();`;
}

function buildStatusBadgeScript(
  statusInfo: { projectName: string; status: string; completionPercent: number; milestonesSummary: string }
): string {
  const statusColors: Record<string, string> = {
    active: '#3b82f6',
    'in-progress': '#8b5cf6',
    completed: '#22c55e',
    'on-hold': '#f59e0b',
    pending: '#6b7280',
    cancelled: '#ef4444'
  };
  const color = statusColors[statusInfo.status] || '#6b7280';

  return `(function(){
  var s=document.currentScript;
  var c=document.createElement('div');
  c.id='embed-status-badge';
  s.parentNode.insertBefore(c,s.nextSibling);
  c.innerHTML='<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid #e5e7eb;border-radius:20px;font-family:-apple-system,sans-serif;font-size:13px;background:#fff;">'
    +'<span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>'
    +'<span style="font-weight:600;color:#333;">${statusInfo.projectName.replace(/'/g, '\\\'')}</span>'
    +'<span style="color:#888;">${statusInfo.status.replace(/-/g, ' ')}</span>'
    +'<span style="color:#555;">${statusInfo.completionPercent}%</span>'
    +'</div>';
})();`;
}

export default router;
