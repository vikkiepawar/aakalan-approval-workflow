declare const process: { env: Record<string, string | undefined> };
declare const require: (moduleName: string) => any;

type Request = any;
type Response = any;

const { Router } = require('express');
const { GoogleGenAI } = require('@google/genai');
import { queryOne, queryAll } from '../db.js';

export const voiceRouter = Router();

const SYSTEM_GUIDANCE = `You are the aakalan Voice Assistant (आकलन वॉयस असिस्टेंट / आकलन आवाज सहाय्यक).
Answer concisely (2-4 sentences maximum) in spoken, natural, polite style.
Support English, Hindi (हिंदी), and Marathi (मराठी). Match the language of the prompt or requested language.

Help the user understand:
1. Navigation of aakalan (Institution, Scrutiny, Regional/EVC, and Administrator desks).
2. How to submit applications (EoA, Increase Intake, New Course).
3. Current workflow stages (Scrutiny, EVC, SAC/SHC, Final Approval).
4. Statutory documents (Land Title, Building Plan, Fire Safety NOC, AICTE Affidavit) and validity.
5. Recorded reasons for deficiency returns and how to rectify.
6. Pending or overdue tasks and approaching deadlines.
7. Compliance checklists and time-bound undertakings.
8. How scrutiny officers draft deficiency notices (CRITICAL, MAJOR, MINOR).`;

voiceRouter.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, language = 'English', context = {} } = req.body;
    if (!question) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add your key in Settings > Secrets.'
      });
      return;
    }

    // Context facts from database
    const now = new Date().toISOString();
    const pendingCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE status NOT IN ("APPROVED", "REJECTED")')?.count || 0;
    const overdueCount = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE stage_deadline_at < ? AND status NOT IN ("APPROVED", "REJECTED")', [now])?.count || 0;
    const expiringDocs = queryAll<any>('SELECT title, document_type, valid_to FROM documents ORDER BY valid_to ASC LIMIT 3');
    const returnedApps = queryAll<any>('SELECT application_number, status FROM applications WHERE status = "CORRECTION_REQUIRED" LIMIT 2');

    const facts = `Current system context:
- Total pending applications: ${pendingCount}
- Overdue cases: ${overdueCount}
- Documents expiring soonest: ${expiringDocs.map(d => `${d.title} (valid to ${d.valid_to})`).join(', ')}
- Applications returned for correction: ${returnedApps.map(a => a.application_number).join(', ') || 'None'}
- User role context: ${context.role || 'GUEST'}
- User requested language: ${language}`;

    const ai = new GoogleGenAI({ apiKey });
    let replyText = '';

    try {
      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${SYSTEM_GUIDANCE}\n\nFacts:\n${facts}\n\nUser Question (respond in ${language}):\n"${question}"` }
            ]
          }
        ]
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out')), 3500)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      replyText = response.text || '';
    } catch (genErr: any) {
      console.warn('Gemini generateContent temporary spike, using local factual synthesizer:', genErr?.message);
      
      const qLower = question.toLowerCase();
      if (qLower.includes('expir') || qLower.includes('document') || qLower.includes('दस्तावेज') || qLower.includes('कागदपत्र')) {
        if (language === 'Hindi') {
          replyText = `वर्तमान में ${expiringDocs.length} सांविधिक दस्तावेज शीघ्र समाप्त होने वाले हैं, जिनमें ${expiringDocs.map(d => d.title).join(' और ')} शामिल हैं। कृपया समय पर नवीनीकरण सुनिश्चित करें।`;
        } else if (language === 'Marathi') {
          replyText = `सध्या ${expiringDocs.length} वैधानिक कागदपत्रे लवकरच कालबाह्य होत आहेत, ज्यात ${expiringDocs.map(d => d.title).join(' आणि ')} समाविष्ट आहेत. कृपया मुदतीत नूतनीकरण करा.`;
        } else {
          replyText = `Currently, ${expiringDocs.length} statutory documents are approaching expiry: ${expiringDocs.map(d => `${d.title} (valid until ${d.valid_to})`).join(', ')}. Please submit renewal endorsements on time.`;
        }
      } else if (qLower.includes('stage') || qLower.includes('status') || qLower.includes('चरण') || qLower.includes('टप्पा')) {
        if (language === 'Hindi') {
          replyText = `प्रणाली में कुल ${pendingCount} आवेदन लंबित हैं और ${overdueCount} मामले समयसीमा पार कर चुके हैं। प्रत्येक आवेदन संवीक्षा, ईव्हीसी निरीक्षण, एसएसी सुनावणी और अंतिम अनुमोदन चरणों से गुजरता है।`;
        } else if (language === 'Marathi') {
          replyText = `प्रणालीमध्ये एकूण ${pendingCount} अर्ज प्रलंबित असून ${overdueCount} प्रकरणांची मुदत संपली आहे. प्रत्येक अर्ज छाननी, ईव्हीसी भेट, एसएसी सुनावणी आणि अंतिम मंजुरी या टप्प्यांतून जातो.`;
        } else {
          replyText = `There are currently ${pendingCount} pending applications in the workflow, with ${overdueCount} cases overdue. Dossiers advance through Document Scrutiny, EVC Inspection, SAC/SHC Hearing, and Final Executive Decision.`;
        }
      } else if (qLower.includes('return') || qLower.includes('deficien') || qLower.includes('वापस') || qLower.includes('परत') || qLower.includes('त्रुटी')) {
        if (language === 'Hindi') {
          replyText = `आवेदन संवीक्षा अधिकारी द्वारा अनिवार्य कारणों और कमी (Deficiencies) के साथ वापस किए जाते हैं। संस्थान अपने डैशबोर्ड पर 'Deficiencies & Corrections' में जाकर सुधार और स्पष्टीकरण प्रस्तुत कर सकते हैं।`;
        } else if (language === 'Marathi') {
          replyText = `अर्ज छाननी अधिकाऱ्यांनी नोंदवलेल्या त्रुटी आणि कारणांमुळे दुरुस्तीसाठी परत केले जातात. संस्था आपल्या डॅशबोर्डवरील 'Deficiencies & Corrections' मधून आवश्यक स्पष्टीकरण आणि कागदपत्रे पुन्हा सादर करू शकते.`;
        } else {
          replyText = `Applications are returned when scrutiny officers record deficiencies such as missing land title endorsements or fire safety certificates. Institutions can view the recorded reason and submit rectifications under the Deficiencies desk.`;
        }
      } else {
        if (language === 'Hindi') {
          replyText = `एआईसीटीई फ्लो में आपका स्वागत है। आप संस्थान, संवीक्षा, क्षेत्रीय ईव्हीसी और व्यवस्थापक डैशबोर्ड का उपयोग कर सकते हैं। नया आवेदन जमा करने के लिए 'New Application' पर क्लिक करें।`;
        } else if (language === 'Marathi') {
          replyText = `एआयसीटीई फ्लो मध्ये आपले स्वागत आहे. आपण संस्था, छाननी, प्रादेशिक ईव्हीसी आणि ॲडमिन डॅशबोर्ड वापरू शकता. नवीन अर्ज सादर करण्यासाठी 'New Application' वर क्लिक करा.`;
        } else {
          replyText = `Welcome to aakalan. The platform routes institutional applications through configured scrutiny, EVC visit scheduling, and appellate SAC/SHC stages. You can track SLA deadlines and upload documents from your role dashboard.`;
        }
      }
    }

    res.json({
      replyText,
      language
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Voice query error: ' + (err.message || 'Unknown error'),
      replyText: 'aakalan Voice Assistant is active. Please ask your question regarding applications, workflow stages, or statutory documents.'
    });
  }
});
