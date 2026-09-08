import React from 'react';
import { X, ShieldCheck, Check, Minus, Info } from 'lucide-react';
import { UserRole } from '../types';

interface RoleMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLight: boolean;
}

interface RoleFeature {
  feature: string;
  description: string;
  developer: boolean;
  roAdmin: boolean;
  roEvaluator: boolean;
  roReviewer: boolean;
  roPreparer: boolean;
  imoAdmin: boolean;
  imoEvaluator: boolean;
  imoReviewer: boolean;
  imoPreparer: boolean;
  field: boolean;
  viewer: boolean;
}

const ROLE_PERMISSIONS: RoleFeature[] = [
  {
    feature: 'View Interactive GIS Map & Canal Layers',
    description: 'Browse irrigation networks, structures, stationings, and satellite imagery',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: true,
    roPreparer: true,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: true,
    field: true,
    viewer: true,
  },
  {
    feature: 'Access Control & User Admissions (Regional & All IMOs)',
    description: 'Review and admit Google accounts, assign roles and NIS scopes regional-wide',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: false,
    imoEvaluator: false,
    imoReviewer: false,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
  {
    feature: 'Access Control & User Admissions (Designated IMO Jurisdiction)',
    description: 'Review and admit Google accounts, assign roles within specific IMO office',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: false,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
  {
    feature: 'Submit Form 691 Field Inspection & Photos',
    description: 'Upload Before/During/After photos, GPS pins, volume measurements',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: true,
    roPreparer: true,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: true,
    field: true,
    viewer: false,
  },
  {
    feature: 'AI Multimodal Photo Vision & Captioning',
    description: 'Gemini Vision analysis of canal desiltation, defect detection',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: true,
    roPreparer: true,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: true,
    field: true,
    viewer: false,
  },
  {
    feature: 'IMO Preparer Review & Pre-Approval (Stage 1)',
    description: 'Review field reports and endorse to IMO Reviewer',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: true,
    field: false,
    viewer: false,
  },
  {
    feature: 'IMO Reviewer Quality Endorsement (Stage 2)',
    description: 'Technical evaluation and endorsement of NIS maintenance reports',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
  {
    feature: 'IMO Division Manager Evaluation (Stage 3)',
    description: 'Division Manager endorsement of IMO maintenance packages & forward to RO',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: false,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
  {
    feature: 'Regional Office Multi-Tier Approval (Stages 4-6)',
    description: 'RO Preparer, RO Reviewer, and RO Division Manager final evaluation',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: true,
    roPreparer: true,
    imoAdmin: false,
    imoEvaluator: false,
    imoReviewer: false,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
  {
    feature: 'Final Regional Approval & Publishing (Stage 7)',
    description: 'Executive evaluation and publication to public GIS and permanent ledger',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: false,
    imoEvaluator: false,
    imoReviewer: false,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
  {
    feature: 'Official PDF Export & AutoTable Generation',
    description: 'Export Form 691 with official header logos, ISO badges, signatures',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: true,
    roPreparer: true,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: true,
    field: true,
    viewer: true,
  },
  {
    feature: 'Google Drive Official Archive Sync',
    description: 'Sync reports to designated Regional / IMO Drive repositories',
    developer: true,
    roAdmin: true,
    roEvaluator: true,
    roReviewer: true,
    roPreparer: true,
    imoAdmin: true,
    imoEvaluator: true,
    imoReviewer: true,
    imoPreparer: true,
    field: false,
    viewer: false,
  },
  {
    feature: 'Developer Master Tools & System Configuration',
    description: 'Manage registered accounts, override passcodes, simulate tiers',
    developer: true,
    roAdmin: true,
    roEvaluator: false,
    roReviewer: false,
    roPreparer: false,
    imoAdmin: true,
    imoEvaluator: false,
    imoReviewer: false,
    imoPreparer: false,
    field: false,
    viewer: false,
  },
];

export const RoleMatrixModal: React.FC<RoleMatrixModalProps> = ({
  isOpen,
  onClose,
  isLight,
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xl animate-in fade-in ${
      isLight ? 'bg-slate-900/40' : 'bg-slate-950/80'
    }`}>
      <div className={`w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] transition-colors duration-300 ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#009933]/15 border border-[#009933]/30 flex items-center justify-center text-[#009933]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading">
                6-Tier Institutional Role &amp; Permissions Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Official RBAC capabilities for NIA Region IV-B MIMAROPA O&amp;M System
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight ? 'border-slate-300 hover:bg-slate-200 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4 custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[840px]">
            <thead>
              <tr className={`border-b text-[10px] uppercase tracking-wider ${
                isLight ? 'border-slate-200 text-slate-500 bg-slate-50' : 'border-slate-800 text-slate-400 bg-slate-800/40'
              }`}>
                <th className="py-2.5 px-3 font-bold">Feature / Permission</th>
                <th className="py-2.5 px-1.5 text-center text-rose-500 font-bold">Dev</th>
                <th className="py-2.5 px-1.5 text-center text-fuchsia-500 font-bold">RO Admin</th>
                <th className="py-2.5 px-1.5 text-center text-purple-500 font-bold">RO Eval</th>
                <th className="py-2.5 px-1.5 text-center text-blue-500">RO Rev</th>
                <th className="py-2.5 px-1.5 text-center text-indigo-500">RO Prep</th>
                <th className="py-2.5 px-1.5 text-center text-orange-500 font-bold">IMO Admin</th>
                <th className="py-2.5 px-1.5 text-center text-amber-500 font-bold">IMO Eval</th>
                <th className="py-2.5 px-1.5 text-center text-cyan-500">IMO Rev</th>
                <th className="py-2.5 px-1.5 text-center text-teal-500">IMO Prep</th>
                <th className="py-2.5 px-1.5 text-center text-emerald-500">Field</th>
                <th className="py-2.5 px-1.5 text-center text-slate-400">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {ROLE_PERMISSIONS.map((perm, idx) => (
                <tr key={idx} className={`hover:bg-slate-500/5 transition ${
                  idx % 2 === 0 ? (isLight ? 'bg-slate-50/40' : 'bg-slate-800/10') : ''
                }`}>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{perm.feature}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{perm.description}</div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center">{perm.developer ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.roAdmin ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.roEvaluator ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.roReviewer ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.roPreparer ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.imoAdmin ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.imoEvaluator ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.imoReviewer ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.imoPreparer ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.field ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                  <td className="py-2.5 px-1.5 text-center">{perm.viewer ? <Check className="w-3.5 h-3.5 mx-auto text-emerald-500" /> : <Minus className="w-3 h-3 mx-auto text-slate-400 opacity-40" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between text-xs ${
          isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-slate-800 bg-slate-900 text-slate-400'
        }`}>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-[#009933]" />
            <span>6-Tier Hierarchical Approval Workflow with Google Account SSO and IMO Jurisdiction Access Control.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#009933] text-white font-bold text-xs hover:bg-[#00802b] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
