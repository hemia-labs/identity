import ejs from 'ejs';
import mjml2html from 'mjml';

export class MailTemplateManager {
  static async render(template: string, data: Record<string, unknown>) {
    const mjml = ejs.render(template, data);
    const result = await mjml2html(mjml, { validationLevel: 'strict' });
    return result.html;
  }
}
