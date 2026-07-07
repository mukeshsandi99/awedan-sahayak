import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApplicationTypeById, getUserProfile, insertGeneratedApplication } from '../database/db';
import type { ApplicationType, UserProfile } from '../types/database';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { API_BASE_URL } from '../config';

// ── Types ───────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'ApplicationForm'>;

/** Which fields are long-text (multiline input + mic button). */
const LONG_TEXT_FIELDS = new Set([
  'incident_details', 'complaint_details', 'grievance_details',
  'threat_details', 'encroachment_details', 'dispute_details',
  'incident_history', 'co_inaction_details', 'refusal_details',
  'damage_description', 'description', 'statement_of_facts',
  'facts_of_case', 'prayer_clause', 'legal_grounds',
  'appeal_grounds', 'desired_action', 'desired_resolution',
  'requested_relief', 'specific_details', 'dowry_demands',
  'dissatisfaction_reason', 'noise_source', 'correction_type',
  'error_description', 'claim_basis', 'grievance_subject',
  'declaration', 'police_action_taken', 'escalation_reason',
  'information_requested', 'immediate_needs', 'prayer',
  'evidence', 'supporting_documents', 'evidence_documents',
  'evidence_screenshots', 'witnesses', 'witness_present',
  'suspect_info', 'accused_description', 'accused_names',
  'prior_complaints', 'previous_complaints', 'prior_escalation',
  'prior_actions', 'injury_details',
]);

/** Mapping from field key to bilingual Hindi (English) label. */
const FIELD_LABELS: Record<string, string> = {
  // ── Applicant identity (base fields on every form) ─────────────
  applicant_name: 'आवेदक का नाम (Applicant Name)',
  applicant_address: 'आवेदक का पता (Applicant Address)',
  applicant_phone: 'संपर्क नंबर (Contact Number)',
  parent_spouse_name: 'पिता/पति का नाम (Father\'s/Husband\'s Name)',
  dob: 'जन्म तिथि (Date of Birth)',
  age: 'आयु (Age)',
  gender: 'लिंग (Gender)',
  mobile: 'मोबाइल नंबर (Mobile Number)',
  state: 'राज्य (State)',
  district: 'जिला (District)',
  village: 'गाँव/मौज़ा (Village/Mouza)',
  post: 'डाकघर (Post Office)',
  thana: 'थाना (Police Station)',
  village_panchayat: 'ग्राम पंचायत (Gram Panchayat)',
  address: 'पता (Address)',
  phone: 'फ़ोन नंबर (Phone Number)',
  // ── Personal details ─────────────────────────────────────────
  relation_to_missing: 'गुमशुदा व्यक्ति से संबंध (Relation to Missing Person)',
  relation_to_deceased: 'मृतक से संबंध (Relation to Deceased)',
  occupation: 'व्यवसाय (Occupation)',
  religion: 'धर्म (Religion)',
  caste: 'जाति (Caste)',
  sub_caste: 'उपजाति (Sub-Caste)',
  marital_status: 'वैवाहिक स्थिति (Marital Status)',
  annual_income: 'वार्षिक आय (Annual Income)',
  income: 'आय (Income)',
  income_source: 'आय का स्रोत (Income Source)',
  family_members: 'परिवार में सदस्य संख्या (Family Members)',
  family_members_affected: 'प्रभावित परिवार सदस्य (Affected Family Members)',
  bpl_status: 'BPL स्थिति (BPL Status)',
  aadhar_last4: 'आधार के अंतिम 4 अंक (Aadhaar Last 4 Digits)',
  bank_account: 'बैंक खाता विवरण (Bank Account Details)',
  employer_name: 'नियोक्ता का नाम (Employer Name)',
  father_name: 'पिता का नाम (Father\'s Name)',
  mother_name: 'माता का नाम (Mother\'s Name)',
  head_of_family: 'मुखिया का नाम (Head of Family)',
  // ── Incident ─────────────────────────────────────────────────
  incident_date: 'घटना की तिथि (Incident Date)',
  incident_time: 'घटना का समय (Incident Time)',
  incident_details: 'घटना का विवरण (Incident Details)',
  incident_type: 'घटना का प्रकार (Incident Type)',
  location: 'घटना स्थल (Location)',
  // ── Theft ────────────────────────────────────────────────────
  stolen_items: 'चुराई गई वस्तुएं (Stolen Items)',
  vehicle_type: 'वाहन का प्रकार (Vehicle Type)',
  registration_number: 'पंजीकरण संख्या (Registration Number)',
  chassis_number: 'चेसिस नंबर (Chassis Number)',
  theft_date: 'चोरी की तिथि (Theft Date)',
  theft_location: 'चोरी का स्थान (Theft Location)',
  vehicle_color: 'वाहन का रंग (Vehicle Color)',
  // ── Missing person ───────────────────────────────────────────
  missing_person_name: 'गुमशुदा व्यक्ति का नाम (Missing Person Name)',
  missing_person_age: 'गुमशुदा व्यक्ति की आयु (Missing Person Age)',
  last_seen_date: 'अंतिम बार देखे जाने की तिथि (Last Seen Date)',
  last_seen_location: 'अंतिम स्थान (Last Seen Location)',
  // ── Documents ────────────────────────────────────────────────
  document_type: 'दस्तावेज़ का प्रकार (Document Type)',
  document_number: 'दस्तावेज़ संख्या (Document Number)',
  lost_date: 'खोने की तिथि (Date Lost)',
  lost_location: 'खोने का स्थान (Place Lost)',
  issuing_authority: 'जारीकर्ता प्राधिकरण (Issuing Authority)',
  // ── Threat / Assault / Accused ───────────────────────────────
  threat_details: 'खतरे का विवरण (Threat Details)',
  threat_type: 'खतरे का प्रकार (Threat Type)',
  threat_source: 'खतरे का स्रोत (Threat Source)',
  accused_name: 'आरोपी का नाम (Accused Name)',
  accused_names: 'आरोपियों के नाम (Accused Names)',
  accused_father_name: 'आरोपी के पिता/पति का नाम (Accused Father\'s/Husband\'s Name)',
  accused_village: 'आरोपी का गाँव/पता (Accused Village/Address)',
  accused_description: 'आरोपी का विवरण (Accused Description)',
  injury_details: 'चोट का विवरण (Injury Details)',
  weapons_used: 'हथियार का प्रयोग (Weapons Used)',
  witnesses: 'गवाह (Witnesses)',
  witness_present: 'गवाह उपस्थित थे (Witnesses Present)',
  suspect_info: 'संदिग्ध की जानकारी (Suspect Information)',
  evidence: 'सबूत (Evidence)',
  evidence_screenshots: 'सबूत/स्क्रीनशॉट (Evidence/Screenshots)',
  evidence_documents: 'सबूत/दस्तावेज़ (Evidence Documents)',
  supporting_documents: 'संलग्न दस्तावेज़ (Supporting Documents)',
  prior_complaints: 'पूर्व शिकायतें (Prior Complaints)',
  prior_complaint_date: 'पूर्व शिकायत की तिथि (Prior Complaint Date)',
  prior_incidents: 'पूर्व की घटनाएँ (Prior Incidents)',
  previous_complaints: 'पूर्व में दर्ज शिकायतें (Previous Complaints)',
  prior_escalation: 'पूर्व एस्कलेशन विवरण (Prior Escalation Details)',
  prior_actions: 'पूर्व में की गई कार्रवाई (Prior Actions Taken)',
  // ── Encroachment / Land disputes ─────────────────────────────
  encroacher_name: 'अतिक्रमणकर्ता का नाम (Encroacher Name)',
  encroacher_father_name: 'अतिक्रमणकर्ता के पिता/पति का नाम (Encroacher Father\'s/Husband\'s Name)',
  encroacher_village: 'अतिक्रमणकर्ता का गाँव/पता (Encroacher Village/Address)',
  encroachment_details: 'अतिक्रमण का विवरण (Encroachment Details)',
  since_when: 'अतिक्रमण की अवधि (Since When)',
  opposing_party: 'विपक्षी पक्ष का नाम (Opposing Party Name)',
  opposing_party_name: 'विपक्षी का नाम (Opposing Party Name)',
  opposing_party_father_name: 'विपक्षी के पिता/पति का नाम (Opposing Party Father\'s/Husband\'s Name)',
  opposing_party_village: 'विपक्षी का गाँव/पता (Opposing Party Village/Address)',
  dispute_type: 'विवाद का प्रकार (Dispute Type)',
  dispute_details: 'विवाद का विवरण (Dispute Details)',
  claim_basis: 'दावे का आधार (Claim Basis)',
  property_details: 'संपत्ति/विषय का विवरण (Property/Subject Details)',
  boundary_dispute: 'सीमा विवाद (Boundary Dispute)',
  // ── FIR ──────────────────────────────────────────────────────
  fir_number: 'FIR संख्या (FIR Number)',
  fir_date: 'FIR दिनांक (FIR Date)',
  fir_subject: 'FIR का विषय (FIR Subject)',
  reason_for_fir: 'FIR का कारण (Reason for FIR)',
  reason_for_copy: 'प्रति की आवश्यकता का कारण (Reason for Copy)',
  complaint_date: 'शिकायत की तिथि (Complaint Date)',
  complaint_details: 'शिकायत का विवरण (Complaint Details)',
  desired_action: 'वांछित कार्रवाई (Desired Action)',
  subject: 'विषय (Subject)',
  purpose: 'प्रयोजन (Purpose)',
  // ── Certificates ─────────────────────────────────────────────
  certificate_type: 'प्रमाण पत्र का प्रकार (Certificate Type)',
  correction_type: 'सुधार का प्रकार (Correction Type)',
  correction_field: 'सुधार का विवरण (Correction Details)',
  current_info: 'वर्तमान गलत जानकारी (Current Incorrect Info)',
  current_details: 'वर्तमान गलत विवरण (Current Incorrect Details)',
  correct_info: 'सही जानकारी (Correct Info)',
  correct_details: 'सही विवरण (Correct Details)',
  reason: 'कारण (Reason)',
  duration_at_address: 'वर्तमान पते पर निवास अवधि (Duration at Current Address)',
  duration_of_residence: 'निवास अवधि (Duration of Residence)',
  duration: 'अवधि (Duration)',
  duration_of_issue: 'समस्या की अवधि (Duration of Issue)',
  previous_address: 'पूर्व का पता (Previous Address)',
  parent_caste_certificate: 'पिता/पति का जाति प्रमाण पत्र विवरण (Parent\'s Caste Certificate)',
  birth_certificate_number: 'जन्म प्रमाण पत्र संख्या (Birth Certificate Number)',
  registration_date: 'पंजीकरण तिथि (Registration Date)',
  child_name: 'बच्चे का नाम (Child\'s Name)',
  deceased_name: 'मृतक का नाम (Deceased Name)',
  death_date: 'मृत्यु की तिथि (Date of Death)',
  death_place: 'मृत्यु स्थल (Place of Death)',
  cause_of_death: 'मृत्यु का कारण (Cause of Death)',
  hospital_name: 'अस्पताल का नाम (Hospital Name)',
  // ── Land records ─────────────────────────────────────────────
  khasra_number: 'खसरा नंबर (Khasra Number)',
  khata_number: 'खाता नंबर (Khata Number)',
  land_area: 'भूमि क्षेत्रफल (Land Area)',
  land_ownership: 'भूमि स्वामित्व (Land Ownership)',
  measurement_reason: 'नापी का कारण (Reason for Measurement)',
  mutation_reason: 'नामांतरण का कारण (Reason for Mutation)',
  previous_owner: 'पूर्व स्वामी का नाम (Previous Owner Name)',
  new_owner: 'नए स्वामी का नाम (New Owner Name)',
  succession_document: 'उत्तराधिकार/वसीयत दस्तावेज़ (Succession/Will Document)',
  record_type: 'अभिलेख का प्रकार (Record Type)',
  year: 'वर्ष (Year)',
  error_description: 'त्रुटि का विवरण (Error Description)',
  // ── CO / SDO ─────────────────────────────────────────────────
  co_office_name: 'CO कार्यालय का नाम (CO Office Name)',
  co_decision_date: 'CO निर्णय की तिथि (CO Decision Date)',
  co_case_number: 'CO केस संख्या (CO Case Number)',
  co_inaction_details: 'CO कार्यालय की निष्क्रियता का विवरण (CO Inaction Details)',
  dissatisfaction_reason: 'असंतोष का कारण (Reason for Dissatisfaction)',
  requested_relief: 'वांछित राहत (Requested Relief)',
  urgency: 'तत्कालिकता का कारण (Reason for Urgency)',
  urgency_level: 'तत्कालिकता स्तर (Urgency Level)',
  rejection_date: 'अस्वीकृति की तिथि (Rejection Date)',
  rejection_reason: 'अस्वीकृति का कारण (Rejection Reason)',
  appeal_grounds: 'अपील के आधार (Appeal Grounds)',
  lower_office_name: 'निचले कार्यालय का नाम (Lower Office Name)',
  // ── Police / SP ──────────────────────────────────────────────
  police_station_name: 'थाने का नाम (Police Station Name)',
  officer_name: 'अधिकारी का नाम (Officer Name)',
  officer_designation: 'पद/डिज़िग्नेशन (Designation)',
  refusal_details: 'FIR दर्ज न करने का विवरण (Refusal Details)',
  police_action_taken: 'अब तक की गई पुलिस कार्रवाई (Police Action Taken)',
  escalation_reason: 'एस्कलेशन का कारण (Escalation Reason)',
  missing_complaint_date: 'गुमशुदगी रिपोर्ट की तिथि (Missing Complaint Date)',
  // ── Admin / DC ───────────────────────────────────────────────
  department_name: 'विभाग का नाम (Department Name)',
  concerned_officer: 'संबंधित अधिकारी/कर्मचारी (Concerned Officer/Official)',
  grievance_subject: 'शिकायत का विषय (Grievance Subject)',
  grievance_details: 'शिकायत का विवरण (Grievance Details)',
  grievance_category: 'शिकायत की श्रेणी (Grievance Category)',
  desired_resolution: 'वांछित समाधान (Desired Resolution)',
  affected_parties: 'प्रभावित पक्ष (Affected Parties)',
  timeline: 'समयावधि (Timeline)',
  prayer: 'प्रार्थना/अनुरोध (Prayer/Request)',
  // ── Schemes & benefits ───────────────────────────────────────
  scheme_name: 'योजना का नाम (Scheme Name)',
  fund_name: 'निधि/योजना का नाम (Fund/Scheme Name)',
  project_name: 'परियोजना का नाम (Project Name)',
  current_house_type: 'वर्तमान आवास का प्रकार (Current House Type)',
  preferred_work: 'पसंदीदा कार्य (Preferred Work)',
  job_card_number: 'जॉब कार्ड संख्या (Job Card Number)',
  panchayat_name: 'पंचायत का नाम (Panchayat Name)',
  amount_involved: 'संबंधित राशि (Amount Involved)',
  amount: 'राशि (Amount)',
  estimated_loss: 'अनुमानित हानि (Estimated Loss)',
  pension_type: 'पेंशन का प्रकार (Pension Type)',
  ration_card_number: 'राशन कार्ड संख्या (Ration Card Number)',
  // ── RTI ──────────────────────────────────────────────────────
  information_requested: 'मांगी गई सूचना का विवरण (Information Requested)',
  time_period: 'समयावधि (Time Period)',
  format_required: 'सूचना का प्रारूप (Format Required)',
  ipo_details: 'IPO/शुल्क विवरण (IPO/Fee Details)',
  // ── Disaster relief ──────────────────────────────────────────
  disaster_type: 'आपदा का प्रकार (Disaster Type)',
  disaster_date: 'आपदा की तिथि (Disaster Date)',
  affected_area: 'प्रभावित क्षेत्र (Affected Area)',
  damage_description: 'क्षति का विवरण (Damage Description)',
  immediate_needs: 'तत्कालिक आवश्यकताएं (Immediate Needs)',
  insurance_info: 'बीमा जानकारी (Insurance Information)',
  // ── Dowry / Domestic ─────────────────────────────────────────
  dowry_demands: 'दहेज की मांग का विवरण (Dowry Demands Details)',
  incident_history: 'पूर्व की घटनाएं (Incident History)',
  declaration: 'स्व-घोषणा (Self-Declaration)',
  // ── Cyber crime ──────────────────────────────────────────────
  platform: 'प्लेटफॉर्म/माध्यम (Platform/Medium)',
  fraud_amount: 'धोखाधड़ी की राशि (Fraud Amount)',
  // ── Noise ────────────────────────────────────────────────────
  noise_source: 'शोर का स्रोत (Noise Source)',
  timing: 'समय (Timing)',
  // ── Court / Legal ────────────────────────────────────────────
  deponent_name: 'शपथकर्ता का नाम (Deponent Name)',
  deponent_father_name: 'शपथकर्ता के पिता/पति का नाम (Deponent Father\'s/Husband\'s Name)',
  deponent_age: 'शपथकर्ता की आयु (Deponent Age)',
  deponent_address: 'शपथकर्ता का पता (Deponent Address)',
  statement_of_facts: 'तथ्यों का विवरण (Statement of Facts)',
  court_name: 'न्यायालय का नाम (Court Name)',
  petitioner_name: 'याचिकाकर्ता का नाम (Petitioner Name)',
  respondent_name: 'प्रत्यर्थी/विपक्षी का नाम (Respondent/Opposing Party Name)',
  respondent_father_name: 'प्रत्यर्थी के पिता/पति का नाम (Respondent Father\'s/Husband\'s Name)',
  respondent_village: 'प्रत्यर्थी का गाँव/पता (Respondent Village/Address)',
  case_type: 'वाद का प्रकार (Case Type)',
  facts_of_case: 'मामले के तथ्य (Facts of the Case)',
  legal_grounds: 'विधिक आधार (Legal Grounds)',
  prayer_clause: 'प्रार्थना खंड (Prayer Clause)',
  // ── EWS / Miscellaneous ──────────────────────────────────────
  specific_details: 'विशेष विवरण (Specific Details)',

  // ── Bank ─────────────────────────────────────────────────────
  account_number: 'खाता संख्या (Account Number)',
  bank_name: 'बैंक का नाम (Bank Name)',
  branch_name: 'शाखा का नाम (Branch Name)',
  old_branch: 'पुरानी शाखा (Old Branch)',
  new_branch: 'नई शाखा (New Branch)',
  cheque_leaves: 'चेक बुक में पन्नों की संख्या (Number of Cheque Leaves)',
  closure_reason: 'खाता बंद करने का कारण (Account Closure Reason)',
  transfer_reason: 'स्थानांतरण का कारण (Transfer Reason)',
  balance_settlement: 'शेष राशि निपटान (Balance Settlement)',
  update_details: 'अद्यतन का विवरण (Update Details)',
  loss_reason: 'खोने/क्षति का कारण (Reason for Loss/Damage)',

  // ── College / School ─────────────────────────────────────────
  college_name: 'महाविद्यालय का नाम (College Name)',
  school_name: 'विद्यालय का नाम (School Name)',
  course_name: 'पाठ्यक्रम का नाम (Course Name)',
  class_name: 'कक्षा (Class)',
  roll_number: 'अनुक्रमांक/रोल नंबर (Roll Number)',
  academic_year: 'शैक्षणिक वर्ष (Academic Year)',
  exam_year: 'परीक्षा वर्ष (Exam Year)',
  academic_performance: 'शैक्षणिक प्रदर्शन (Academic Performance)',
  father_occupation: 'पिता का व्यवसाय (Father\'s Occupation)',
  family_income: 'पारिवारिक आय (Family Income)',
  father_husband_name: 'पिता/पति का नाम (Father\'s/Husband\'s Name)',
  new_institution: 'नए संस्थान का नाम (New Institution Name)',
  new_school: 'नए विद्यालय का नाम (New School Name)',
  leave_reason: 'अवकाश का कारण (Reason for Leave)',
  leave_dates: 'अवकाश की तिथियाँ (Leave Dates)',
  leave_duration: 'अवकाश अवधि (Leave Duration)',

  // ── PWD / RCD / BCD ──────────────────────────────────────────
  construction_justification: 'निर्माण का औचित्य (Construction Justification)',
  construction_site_location: 'निर्माण स्थल (Construction Site Location)',
  estimated_cost: 'अनुमानित लागत (Estimated Cost)',
  estimated_distance: 'अनुमानित दूरी (Estimated Distance)',
  estimated_length: 'अनुमानित लंबाई (Estimated Length)',
  road_type: 'सड़क का प्रकार (Road Type)',
  road_location: 'सड़क का स्थान (Road Location)',
  village_road_location: 'ग्रामीण सड़क का स्थान (Village Road Location)',
  road_condition_details: 'सड़क की वर्तमान स्थिति (Current Road Condition)',
  connecting_villages: 'जुड़ने वाले गाँव (Connecting Villages)',
  population_served: 'लाभान्वित जनसंख्या (Population Served)',
  traffic_impact: 'यातायात पर प्रभाव (Traffic Impact)',
  alternative_route: 'वैकल्पिक मार्ग (Alternative Route)',
  community_benefit: 'सामुदायिक लाभ (Community Benefit)',
  bridge_location: 'पुल का स्थान (Bridge Location)',
  water_body_name: 'जल स्रोत का नाम (Water Body Name)',
  water_flow_details: 'जल प्रवाह विवरण (Water Flow Details)',
  culvert_location: 'पुलिया का स्थान (Culvert Location)',
  current_crossing_method: 'वर्तमान आवागमन विधि (Current Crossing Method)',
  building_name: 'भवन का नाम (Building Name)',
  building_purpose: 'भवन का उद्देश्य (Building Purpose)',
  building_age: 'भवन की आयु (Building Age)',
  last_repair_date: 'अंतिम मरम्मत की तिथि (Last Repair Date)',
  damage_details: 'क्षति का विवरण (Damage Details)',
  quality_issues: 'गुणवत्ता संबंधी समस्याएँ (Quality Issues)',
  contractor_name: 'ठेकेदार का नाम (Contractor Name)',
  safety_concern: 'सुरक्षा चिंता (Safety Concern)',
  safety_risk: 'सुरक्षा जोखिम (Safety Risk)',
  incident_impact: 'घटना का प्रभाव (Incident Impact)',
  affected_villages: 'प्रभावित गाँव (Affected Villages)',
  agricultural_impact: 'कृषि पर प्रभाव (Agricultural Impact)',
  land_availability: 'भूमि उपलब्धता (Land Availability)',
  justification: 'औचित्य/कारण (Justification)',

  // ── Missing person / Theft ───────────────────────────────────
  clothing_last_seen: 'अंतिम बार पहने हुए कपड़े (Clothing Last Seen)',
  description: 'शारीरिक विवरण (Physical Description)',
  identifying_marks: 'पहचान चिह्न (Identifying Marks)',
  mental_condition: 'मानसिक स्थिति (Mental Condition)',
  medical_report: 'चिकित्सीय रिपोर्ट (Medical Report)',
  engine_number: 'इंजन नंबर (Engine Number)',
  theft_time: 'चोरी का समय (Theft Time)',
  circumstances: 'परिस्थितियाँ (Circumstances)',

  // ── Marriage / Dowry ─────────────────────────────────────────
  marriage_date: 'विवाह की तिथि (Marriage Date)',

  // ── Land / CO ────────────────────────────────────────────────
  encroachment_area: 'अतिक्रमित क्षेत्रफल (Encroachment Area)',
  death_date_of_owner: 'मूल स्वामी की मृत्यु तिथि (Original Owner Death Date)',
  plot_number: 'प्लॉट नंबर (Plot Number)',
  mouja_name: 'मौज़ा का नाम (Mouza Name)',
  purpose_of_lpc: 'LPC/रसीद का प्रयोजन (Purpose of LPC/Receipt)',
  dispute_description: 'विवाद का कालानुक्रमिक विवरण (Chronological Dispute Description)',
  deceased_father_name: 'मृतक के पिता/पति का नाम (Deceased Father\'s/Husband\'s Name)',

  // ── FIR / Police ─────────────────────────────────────────────
  oral_written_refusal: 'मौखिक या लिखित इनकार (Oral or Written Refusal)',

  // ── Noise ────────────────────────────────────────────────────
  impact: 'प्रभाव (Impact)',

  // ── Pension ──────────────────────────────────────────────────
  disability_percentage: 'विकलांगता प्रतिशत (Disability Percentage)',
};

/** Fields that can be pre-filled from user_profile. */
const PREFILL_MAP: Record<string, keyof UserProfile> = {
  // Base identity — name variants
  applicant_name: 'name',
  deponent_name: 'name',
  petitioner_name: 'name',
  // Base identity — location
  village: 'village',
  post: 'post',
  thana: 'thana',
  district: 'district',
  state: 'state',
  // Base identity — contact
  mobile: 'phone',
  applicant_phone: 'phone',
  // Base identity — personal
  gender: 'gender',
  parent_spouse_name: 'parent_spouse_name',
  // Legacy / combined fallback
  applicant_address: 'address',
  deponent_address: 'address',
};

/**
 * Base applicant identity fields required on EVERY form.
 * These are always prepended to the form (before type-specific fields)
 * so the generated application's header and footer are fully populated.
 * Fields already present in the type's required_fields are not duplicated.
 */
const BASE_IDENTITY_FIELDS = [
  'applicant_name',
  'parent_spouse_name',
  'village',
  'post',
  'thana',
  'district',
  'state',
  'mobile',
  'gender',
];

/** Fields that should use a numeric / phone keyboard. */
const NUMERIC_FIELDS = new Set([
  'applicant_phone', 'phone', 'age', 'aadhar_last4',
  'annual_income', 'income', 'family_members', 'family_members_affected',
  'amount_involved', 'amount', 'estimated_loss', 'fraud_amount',
  'missing_person_age', 'deponent_age',
]);

// ── Component ───────────────────────────────────────────────────────

export default function ApplicationFormScreen({ route, navigation }: Props) {
  const { applicationTypeId } = route.params;

  const [appType, setAppType] = useState<ApplicationType | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Voice recording state
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Voice input hook
  const { isListening, partialText, startListening, stopListening } = useVoiceInput({
    locale: 'hi-IN',
    onResult: (text: string) => {
      if (!activeVoiceField) return;
      setFormData((prev) => {
        const current = prev[activeVoiceField] ?? '';
        if (isLongText(activeVoiceField)) {
          // APPEND for narrative fields — user builds up the story incrementally
          const separator = current.trim().length > 0 ? ' ' : '';
          return { ...prev, [activeVoiceField]: current + separator + text };
        }
        // REPLACE for single-line fields — names, villages, numbers are said once
        return { ...prev, [activeVoiceField]: text };
      });
      setActiveVoiceField(null);
      stopPulse();
    },
    onError: (message: string) => {
      Alert.alert('🎤 आवाज़ त्रुटि', message);
      setActiveVoiceField(null);
      stopPulse();
    },
  });

  // Pulsing animation for recording indicator
  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // ── Load ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [type, profile] = await Promise.all([
          getApplicationTypeById(applicationTypeId),
          getUserProfile(),
        ]);

        setAppType(type);

        // Parse required_fields JSON
        let parsedFields: string[] = [];
        if (type?.required_fields) {
          try {
            parsedFields = JSON.parse(type.required_fields);
          } catch {
            // not valid JSON — leave empty
          }
        }

        // ALWAYS prepend base identity fields (belt-and-suspenders:
        // the DB migration also adds them, but this ensures they
        // appear even before the migration runs on existing installs).
        const existingSet = new Set(parsedFields);
        for (const baseField of BASE_IDENTITY_FIELDS) {
          if (!existingSet.has(baseField)) {
            parsedFields = [baseField, ...parsedFields];
          }
        }
        setFields(parsedFields);

        // Build initial form data with pre-fill from profile
        if (__DEV__) { console.log('[Form Prefill] Profile from DB:', JSON.stringify(profile, null, 2)); }
        if (__DEV__) { console.log('[Form Prefill] Fields to render:', parsedFields); }
        if (__DEV__) { console.log('[Form Prefill] PREFILL_MAP entries:', Object.entries(PREFILL_MAP).map(([k,v]) => `${k}→${v}`).join(', ')); }

        const initial: Record<string, string> = {};
        for (const field of parsedFields) {
          const profileKey = PREFILL_MAP[field];
          if (profileKey && profile && profile[profileKey]) {
            const value = String(profile[profileKey] ?? '');
            initial[field] = value;
            if (__DEV__) { console.log(`[Form Prefill] ✅ ${field} ← profile.${profileKey} = "${value}"`); }
          } else {
            initial[field] = '';
            const reason = !profileKey
              ? `no PREFILL_MAP entry`
              : !profile
                ? `profile is null`
                : `profile.${profileKey} is ${profile[profileKey] === null ? 'null' : profile[profileKey] === undefined ? 'undefined' : 'empty/falsy'}`;
            console.log(`[Form Prefill] ❌ ${field} — ${reason}`);
          }
        }
        setFormData(initial);
      } catch (err) {
        console.error('Failed to load form data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [applicationTypeId]);

  // ── Helpers ─────────────────────────────────────────────────────

  const setField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isLongText = (field: string): boolean => {
    if (LONG_TEXT_FIELDS.has(field)) return true;
    return field.endsWith('_details') || field.endsWith('_description') ||
           field.endsWith('_history') || field.endsWith('_grounds') ||
           field.endsWith('_clause') || field.endsWith('_documents');
  };

  const getKeyboardType = (field: string) => {
    if (NUMERIC_FIELDS.has(field)) return 'phone-pad';
    return 'default';
  };

  const getLabel = (field: string): string => {
    return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
  };

  const allFieldsFilled = fields.every((f) => formData[f]?.trim().length > 0);

  const handleVoiceToggle = async (fieldName: string) => {
    if (activeVoiceField === fieldName) {
      // Already recording this field — stop
      await stopListening();
      setActiveVoiceField(null);
      stopPulse();
    } else {
      // Stop any current recording first
      if (activeVoiceField) {
        await stopListening();
      }
      // Start recording for this field
      setActiveVoiceField(fieldName);
      startPulse();
      await startListening();
    }
  };

  const handleGenerate = async () => {
    if (!allFieldsFilled) return;
    setSubmitting(true);

    const payload = {
      application_type_id: applicationTypeId,
      application_name: appType?.name_hindi ?? '',
      office_type: appType?.office_type ?? '',
      form_data: formData,
      prompt_template: appType?.prompt_template ?? '',
    };

    // ── Debug: log complete form data being sent (dev only) ──
    if (__DEV__) {
      console.log('[ApplicationForm] === FULL FORM DATA BEING SENT ===');
      console.log('[ApplicationForm] Field count:', Object.keys(payload.form_data).length);
      for (const [k, v] of Object.entries(payload.form_data)) {
        console.log(`[ApplicationForm]   ${k}: "${String(v).substring(0, 80)}"`);
      }
      console.log('[ApplicationForm] === END FORM DATA ===');
    }

    try {
      const requestBody = {
        applicationName: payload.application_name,
        officeType: payload.office_type,
        promptTemplate: payload.prompt_template,
        formData: payload.form_data,
      };
      console.log('[ApplicationForm] Sending to:', `${API_BASE_URL}/api/generate-application`);
      console.log('[ApplicationForm] Request body keys:', Object.keys(requestBody));

      const response = await fetch(`${API_BASE_URL}/api/generate-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errMsg = result.error ?? `Server responded with ${response.status}`;
        throw new Error(errMsg);
      }

      console.log(`[ApplicationForm] Generated ${result.generatedText.length} chars via ${result.metadata?.provider}/${result.metadata?.model}`);

      // Save to local SQLite for history
      try {
        await insertGeneratedApplication({
          application_type_id: applicationTypeId,
          office_id: null,
          raw_input_text: JSON.stringify(formData),
          generated_text: result.generatedText,
          pdf_path: null,
          is_escalation_of: null,
        });
        console.log('[ApplicationForm] Saved to generated_applications table.');
      } catch (dbErr: any) {
        console.error('[ApplicationForm] Failed to save to DB:', dbErr?.message);
        // Non-fatal — the generated text is still available on screen
      }

      setSubmitting(false);

      // Navigate to preview screen
      navigation.navigate('ApplicationPreview', {
        applicationName: payload.application_name,
        generatedText: result.generatedText,
        officeType: payload.office_type,
        applicationTypeId,
      });
    } catch (err: any) {
      setSubmitting(false);
      const message = err?.message ?? 'अज्ञात त्रुटि / Unknown error';
      console.error('[ApplicationForm] Generation failed:', message);

      const isNetworkError =
        message.includes('Network request failed') ||
        message.includes('Failed to fetch') ||
        message.includes('timeout') ||
        message.includes('ERR_');

      if (isNetworkError) {
        Alert.alert(
          '📡 सर्वर कनेक्शन त्रुटि',
          'बैकएंड सर्वर से संपर्क नहीं हो पाया।\n\n' +
            'कृपया जाँच करें:\n' +
            '• आपका फ़ोन और कंप्यूटर एक ही WiFi नेटवर्क पर हैं\n' +
            '• सर्वर चालू है (npm run dev)\n\n' +
            'Server unreachable. Ensure your phone and computer are on the same WiFi and the backend server is running.',
          [
            { text: 'रद्द करें', style: 'cancel' },
            { text: 'पुनः प्रयास करें', onPress: () => handleGenerate() },
          ],
        );
      } else {
        Alert.alert(
          '❌ आवेदन जनरेशन त्रुटि',
          `आवेदन पत्र जनरेट करने में त्रुटि हुई:\n\n${message}\n\nकृपया पुनः प्रयास करें।`,
          [
            { text: 'रद्द करें', style: 'cancel' },
            { text: 'पुनः प्रयास करें', onPress: () => handleGenerate() },
          ],
        );
      }
    }
  };

  // ── Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E17055" />
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Legal disclaimer banner for court types */}
        {appType?.requires_legal_disclaimer === 1 &&
          appType.disclaimer_text &&
          !disclaimerDismissed && (
            <View style={styles.disclaimerBanner}>
              <View style={styles.disclaimerContent}>
                <Ionicons name="warning" size={18} color="#D35400" />
                <Text style={styles.disclaimerText}>{appType.disclaimer_text}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDisclaimerDismissed(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#D35400" />
              </TouchableOpacity>
            </View>
          )}

        {/* Application type header */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{appType?.name_hindi}</Text>
          <Text style={styles.headerSubtitle}>{appType?.name_english}</Text>
        </View>

        {/* Dynamic form fields */}
        {fields.map((field) => {
          const long = isLongText(field);
          // Show mic on every text field except gender (tap-to-select)
          const showMic = field !== 'gender';
          return (
            <View key={field} style={styles.fieldContainer}>
              <Text style={styles.label}>{getLabel(field)}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, long && styles.inputMultiline, showMic && !long && styles.inputWithMic]}
                  value={formData[field] ?? ''}
                  onChangeText={(v) => setField(field, v)}
                  placeholder={getLabel(field)}
                  placeholderTextColor="#BBB"
                  multiline={long}
                  numberOfLines={long ? 4 : 1}
                  textAlignVertical={long ? 'top' : 'center'}
                  keyboardType={getKeyboardType(field)}
                />
                {showMic && (
                  <TouchableOpacity
                    style={[
                      long ? styles.micButton : styles.micButtonCompact,
                      activeVoiceField === field && styles.micButtonActive,
                    ]}
                    onPress={() => handleVoiceToggle(field)}
                    activeOpacity={0.6}
                  >
                    {activeVoiceField === field ? (
                      <>
                        {/* Pulsing red dot */}
                        <Animated.View
                          style={[styles.recordingDot, { opacity: pulseAnim }]}
                        />
                        <Ionicons name="stop-circle" size={long ? 22 : 18} color="#D63031" />
                      </>
                    ) : (
                      <Ionicons name="mic" size={long ? 22 : 18} color="#E17055" />
                    )}
                  </TouchableOpacity>
                )}
                {activeVoiceField === field && partialText.length > 0 && (
                  <View style={styles.partialContainer}>
                    <Text style={styles.partialLabel}>🎙️ सुन रहे हैं...</Text>
                    <Text style={styles.partialText} numberOfLines={2}>
                      {partialText}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Generate button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            !allFieldsFilled && styles.generateButtonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!allFieldsFilled || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="create-outline" size={22} color="#FFF" />
              <Text style={styles.generateButtonText}>आवेदन बनाएं</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  centered: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Disclaimer banner
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9E7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  disclaimerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: '#7D6608',
    lineHeight: 19,
  },

  // Header
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#999',
  },

  // Fields
  fieldContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  // Single-line input gets right padding so text doesn't collide with the mic icon
  inputWithMic: {
    paddingRight: 38,
  },
  // Full-size mic for long narrative fields (multiline, needs visual weight)
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  // Compact mic for single-line fields — smaller, vertically centered
  micButtonCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  micButtonActive: {
    backgroundColor: '#FFE8E8',
    borderWidth: 2,
    borderColor: '#FFCDD2',
  },
  recordingDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D63031',
  },
  partialContainer: {
    backgroundColor: '#FFF9F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#E17055',
  },
  partialLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E17055',
    marginBottom: 4,
  },
  partialText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Generate button
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E17055',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 12,
    gap: 10,
    shadowColor: '#E17055',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#CCC',
    shadowColor: '#999',
    shadowOpacity: 0.15,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
