import { useEffect, useState, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FiDownload, FiTrash2 } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';
import Modal from '../components/Modal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { openWhatsApp } from '../utils/whatsapp';
import { downloadBillingPDF } from '../services/pdfService';
import { pickArray } from '../utils/apiResponse';

// Helper function to safely format numbers
const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

const getPaymentStatusBadge = (status) => {
  const map = {
    paid:      { label: 'Paid',      cls: 'bg-green-100 text-green-800' },
    completed: { label: 'Paid',      cls: 'bg-green-100 text-green-800' },
    partial:   { label: 'Partial',   cls: 'bg-blue-100 text-blue-800' },
    pending:   { label: 'Pending',   cls: 'bg-orange-100 text-orange-800' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800' },
    failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-800' },
  };
  return map[status] || { label: status || 'Pending', cls: 'bg-orange-100 text-orange-800' };
};

export default function Receipts() {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipts, setSelectedReceipts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ name: '', uhid: '', phone: '' });
  const [showViewAllModal, setShowViewAllModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  // NEW: Clinic settings state
  const [clinicSettings, setClinicSettings] = useState(null);
  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState(null);
  // Service templates fallback for quick add
  const [_serviceTemplates, setServiceTemplates] = useState([
    { label: 'Consultation', service_name: 'Consultation', qty: 1, unit_price: 500 },
    { label: 'Injection', service_name: 'Injection', qty: 1, unit_price: 150 },
    { label: 'Lab Test', service_name: 'Lab Test', qty: 1, unit_price: 800 }
  ]);
  const [groupedServices, setGroupedServices] = useState({});
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('');
  const [servicePickerTarget, setServicePickerTarget] = useState('create'); // 'create' or 'edit'
  const [editingService, setEditingService] = useState(null); // service being edited
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({ service_name: '', category: '', default_price: 0 });
  const [_unbilledVisits, setUnbilledVisits] = useState([]);
  // Service groups
  const [serviceGroups, setServiceGroups] = useState([]);
  const [servicePickerTab, setServicePickerTab] = useState('services'); // 'services' | 'groups'
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormServices, setGroupFormServices] = useState([]); // [{service_name, unit_price}]
  const [allServices, setAllServices] = useState([]); // flat list
  const [openGroupPopover, setOpenGroupPopover] = useState(null); // group id with open popover

  // Print ref for react-to-print
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Receipt'
  });

  // Create receipt form state
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [receiptForm, setReceiptForm] = useState({
    patient_id: '',
    template_id: '',
    services: [{ service_name: '', qty: 1, unit_price: 0, discount: 0, total: 0 }],
    tax: 0,
    discount: 0,
    additional_discount: 0,
    payment_method: 'cash',
    payment_id: '',
    payment_status: 'pending',
    amount_paid: '',
    notes: '',
    remarks: '',
    cash_amount: '',
    upi_amount: ''
  });

  // NEW: Fetch clinic settings
  const fetchClinicSettings = useCallback(async () => {
    try {
      const res = await api.get('/api/bills/clinic-settings');
      if (res.data.success && res.data.clinic) {
        setClinicSettings(res.data.clinic);
      }
    } catch (error) {
      console.error('Failed to fetch clinic settings:', error);
    }
  }, [api]);

  // Handle individual receipt selection
  const handleSelectReceipt = (receiptId) => {
    setSelectedReceipts(prev => 
      prev.includes(receiptId) 
        ? prev.filter(id => id !== receiptId)
        : [...prev, receiptId]
    );
  };

  // Handle select all receipts
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedReceipts([]);
    } else {
      setSelectedReceipts(receipts.map(r => r.id));
    }
    setSelectAll(!selectAll);
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedReceipts.length === 0) {
      addToast('No receipts selected', 'warning');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedReceipts.length} receipt(s)?`)) {
      return;
    }

    try {
      // Delete all selected receipts
      await Promise.all(
        selectedReceipts.map(id => api.delete(`/api/bills/${id}`))
      );
      
      addToast(`Successfully deleted ${selectedReceipts.length} receipt(s)`, 'success');
      setSelectedReceipts([]);
      setSelectAll(false);
      fetchReceipts();
    } catch (error) {
      console.error('Failed to delete receipts:', error);
      addToast('Failed to delete some receipts', 'error');
    }
  };

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/bills');
      setReceipts(pickArray(res, ['data.bills', 'bills']));
      // Reset selection when receipts change
      setSelectedReceipts([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Fetch unbilled visits
  const fetchUnbilledVisits = useCallback(async () => {
    try {
      const res = await api.get('/api/bills/unbilled-visits');
      // console.log('Unbilled visits fetched:', res.data);
      setUnbilledVisits(res.data?.data?.visits || res.data?.visits || []);
    } catch (error) {
      console.error('Failed to fetch unbilled visits:', error);
    }
  }, [api]);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/api/patients?limit=100');
      // Backend may return paginated shape: { data: { data: [...] } }
      setPatients(pickArray(res, ['data.patients', 'data.data', 'patients']));
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    }
  }, [api]);

  const searchPatientsForReceipt = async (query) => {
    console.log('searchPatientsForReceipt called with query:', query);
    if (!query || query.length < 1) {
      setPatientSearchResults([]);
      return;
    }
    try {
      console.log('Making API call to /api/patients with search:', query);
      const res = await api.get(`/api/patients?search=${encodeURIComponent(query)}&limit=10&context=receipt`);
      console.log('Patient search response:', res.data);
      // Live backend returns ApiResponse.paginated => { data: { data: [...] } }
      const list = pickArray(res, ['data.patients', 'data.data', 'patients']);
      console.log('Extracted patient list:', list);
      setPatientSearchResults(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to search patients:', error);
      addToast(error?.response?.data?.error || 'Failed to search patients', 'error');
    }
  };

  const fetchReceiptTemplates = useCallback(async () => {
    try {
      const res = await api.get('/api/receipt-templates');
      setReceiptTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch receipt templates:', error);
    }
  }, [api]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await api.get('/api/bills/services');
      const services = res.data.services || [];
      const grouped = res.data.grouped || {};

      if (services.length > 0) {
        const mappedServices = services.map(service => ({
          label: service.name,
          service_name: service.name,
          category: service.category || 'Other',
          qty: 1,
          unit_price: parseFloat(service.price) || 0
        }));
        setServiceTemplates(mappedServices);
        setGroupedServices(grouped);
        setAllServices(services);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  }, [api]);

  const fetchServiceGroups = useCallback(async () => {
    try {
      const res = await api.get('/api/bills/service-groups');
      setServiceGroups(res.data.groups || []);
    } catch (error) {
      console.error('Failed to fetch service groups:', error);
    }
  }, [api]);

  // Fetch all data on mount
  useEffect(() => {
    fetchClinicSettings();
    fetchReceipts();
    fetchPatients();
    fetchReceiptTemplates();
    fetchServices();
    fetchServiceGroups();
    fetchUnbilledVisits();
  }, [fetchClinicSettings, fetchReceipts, fetchPatients, fetchReceiptTemplates, fetchServices, fetchServiceGroups, fetchUnbilledVisits, searchParams]);

  // Handle URL parameters (edit mode, quick create, etc.)
  useEffect(() => {
    const quick = searchParams.get('quick');
    const full = searchParams.get('full');
    const create = searchParams.get('create');
    const patientId = searchParams.get('patient');
    const amount = searchParams.get('amount');
    const service = searchParams.get('service');
    const qty = searchParams.get('qty');
    const price = searchParams.get('price');
    const tax = searchParams.get('tax');
    const discount = searchParams.get('discount');
    const receiptId = searchParams.get('receipt'); // Check for specific receipt ID
    const edit = searchParams.get('edit');
    const view = searchParams.get('view');
    const billId = searchParams.get('billId');

    // console.log('Receipt URL Params:', { quick, full, patientId, amount, receiptId, edit, billId });

    // Handle edit mode
    if (edit === 'true' && billId) {
      // console.log('Opening edit modal for bill:', billId);
      // ALWAYS fetch the full bill detail for editing to ensure service_items are loaded
      const fetchBillForEdit = async () => {
        try {
          const detail = await api.get(`/api/bills/${billId}`);
          const bill = detail.data?.bill || detail.data?.data?.bill || detail.data;
          if (bill) {
            // Ensure service_items are properly formatted
            if (!bill.service_items && bill.items) {
              bill.service_items = bill.items;
            }
            // If still no items, create an empty array
            if (!bill.service_items) {
              bill.service_items = [];
            }
            // Ensure all service items have unit_price field
            if (bill.service_items && Array.isArray(bill.service_items)) {
              bill.service_items = bill.service_items.map(item => ({
                ...item,
                unit_price: item.unit_price ?? item.amount ?? 0,
                quantity: item.quantity ?? item.qty ?? 1
              }));
            }
            setEditingReceipt(bill);
            setShowEditModal(true);
          }
        } catch (error) {
          console.error('Failed to fetch bill for edit:', error);
          // Try to find in list as fallback
          const receiptToEdit = receipts.find(r => r.id == billId);
          if (receiptToEdit) {
            setEditingReceipt(receiptToEdit);
            setShowEditModal(true);
          }
        }
      };
      fetchBillForEdit();
    }

    // Handle view-only mode (open receipt preview, not edit form)
    if (view === 'true' && billId) {
      const fetchBillForView = async () => {
        try {
          const detail = await api.get(`/api/bills/${billId}`);
          const bill = detail.data?.bill || detail.data?.data?.bill || detail.data;
          if (bill) {
            if (!bill.service_items && bill.items) bill.service_items = bill.items;
            if (!bill.service_items) bill.service_items = [];
            setSelectedReceipt(bill);
            setShowSuccessModal(true);
          }
        } catch (error) {
          console.error('Failed to fetch bill for view:', error);
          addToast('Failed to view receipt', 'error');
        }
      };
      fetchBillForView();
    }

    // Handle create mode from Queue Dashboard (create=true from Queue)
    if (create === 'true' && patientId) {
      // Pre-fill service details from Queue form
      const serviceName = service ? decodeURIComponent(service) : 'Consultation';
      const serviceQty = parseFloat(qty) || 1;
      const servicePrice = parseFloat(price) || 0;
      const serviceTax = parseFloat(tax) || 0;
      const serviceDiscount = parseFloat(discount) || 0;
      const serviceTotal = (serviceQty * servicePrice) - serviceDiscount;

      setReceiptForm(prev => ({
        ...prev,
        patient_id: patientId,
        tax: serviceTax,
        discount: serviceDiscount,
        services: [{
          service_name: serviceName,
          qty: serviceQty,
          unit_price: servicePrice,
          discount: serviceDiscount,
          total: serviceTotal
        }]
      }));

      // Use setTimeout to ensure state updates after patients are loaded
      setTimeout(() => {
        setShowCreateModal(true);
      }, 100);
    }
    // Only show create modal if we have valid quick/full parameters with patient
    else if (((quick || full) && patientId) && !receiptId && !edit && !view) {
      const parsedAmount = parseFloat(amount) || 0;
      // console.log('Opening create modal for patient:', patientId);

      setReceiptForm(prev => ({
        ...prev,
        patient_id: patientId,
        services: [{
          service_name: full ? 'Consultation' : 'Quick Payment',
          qty: 1,
          unit_price: parsedAmount,
          discount: 0,
          total: parsedAmount
        }]
      }));

      // Use setTimeout to ensure state updates after patients are loaded
      setTimeout(() => {
        setShowCreateModal(true);
      }, 100);
    }
    
    // Show specific receipt if receiptId is provided
    if (receiptId) {
      // console.log('Loading specific receipt:', receiptId);
      // Find and show the specific receipt
      const receipt = receipts.find(r => r.id === parseInt(receiptId));
      if (receipt) {
        setSelectedReceipt(receipt);
        setShowSuccessModal(true);
      }
    }
  }, [searchParams, api, receipts]);

  useEffect(() => {
    if (showViewAllModal) {
      fetchReceipts();
    }
  }, [showViewAllModal, fetchReceipts]);

  // Template selection handler (must be defined before the useEffect that uses it)
  const handleTemplateSelect = useCallback((templateId) => {
    const selectedTemplate = receiptTemplates.find(t => t.id === parseInt(templateId));

    if (selectedTemplate) {
      setReceiptForm({
        ...receiptForm,
        template_id: templateId,
        notes: selectedTemplate.footer_content || '',
        remarks: selectedTemplate.header_content || ''
      });
    } else {
      setReceiptForm({
        ...receiptForm,
        template_id: '',
        notes: '',
        remarks: ''
      });
    }
  }, [receiptTemplates, receiptForm]);

  // Auto-select default template when creating new receipt
  useEffect(() => {
    if (receiptTemplates.length > 0 && showCreateModal && !receiptForm.template_id) {
      const defaultTemplate = receiptTemplates.find(t => t.is_default);
      if (defaultTemplate) {
        handleTemplateSelect(defaultTemplate.id.toString());
      }
    }
  }, [receiptTemplates, showCreateModal, receiptForm.template_id, handleTemplateSelect]);

  // NEW: Helper function to get clinic info from receipt or settings
  const getClinicInfo = (receipt = null) => {
    // Priority: receipt data > clinic settings > defaults
    if (receipt && receipt.clinic_name) {
      return {
        name: receipt.clinic_name,
        address: receipt.clinic_address,
        city: receipt.clinic_city,
        state: receipt.clinic_state,
        pincode: receipt.clinic_pincode,
        phone: receipt.clinic_phone,
        email: receipt.clinic_email,
        logo: receipt.clinic_logo
      };
    }
    
    if (clinicSettings) {
      return {
        name: clinicSettings.name,
        address: clinicSettings.address,
        city: clinicSettings.city,
        state: clinicSettings.state,
        pincode: clinicSettings.pincode,
        phone: clinicSettings.phone,
        email: clinicSettings.email,
        logo: clinicSettings.logo_url
      };
    }
    
    // Default fallback
    return {
      name: 'Healthcare Clinic',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      logo: null
    };
  };

  // NEW: Format full address
  const formatAddress = (clinic) => {
    const parts = [clinic.address, clinic.city, clinic.state, clinic.pincode].filter(Boolean);
    return parts.join(', ');
  };


  // Template preview handler
  const handleTemplatePreview = (templateId) => {
    const template = receiptTemplates.find(t => t.id === parseInt(templateId));
    if (template) {
      setPreviewingTemplate(template);
      setShowTemplatePreview(true);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.name) params.append('name', search.name);
      if (search.uhid) params.append('uhid', search.uhid);
      if (search.phone) params.append('phone', search.phone);

      const res = await api.get(`/api/bills?${params}`);
      setReceipts(pickArray(res, ['data.bills', 'bills']));
    } catch (error) {
      console.error('Failed to search receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = receiptForm.services.reduce((sum, service) => sum + (parseFloat(service.total) || 0), 0);
    const taxAmount = (subtotal * parseFloat(receiptForm.tax || 0)) / 100;
    const total = subtotal + taxAmount - parseFloat(receiptForm.discount || 0) - parseFloat(receiptForm.additional_discount || 0);
    return { subtotal, taxAmount, total };
  };

  const handleServiceChange = (index, field, value) => {
    const updatedServices = [...receiptForm.services];
    updatedServices[index][field] = value;

    if (field === 'qty' || field === 'unit_price' || field === 'discount') {
      const qty = parseFloat(updatedServices[index].qty) || 1;
      const unit_price = parseFloat(updatedServices[index].unit_price) || 0;
      const discount = parseFloat(updatedServices[index].discount) || 0;
      updatedServices[index].total = (qty * unit_price) - discount;
    }

    setReceiptForm({ ...receiptForm, services: updatedServices });
  };

  const addService = () => {
    setReceiptForm({
      ...receiptForm,
      services: [...receiptForm.services, { service_name: '', qty: 1, unit_price: 0, discount: 0, total: 0 }]
    });
  };

  const removeService = (index) => {
    if (receiptForm.services.length > 1) {
      const updatedServices = receiptForm.services.filter((_, i) => i !== index);
      setReceiptForm({ ...receiptForm, services: updatedServices });
    }
  };

  const resetForm = () => {
    setReceiptForm({
      patient_id: '',
      template_id: '',
      services: [{ service_name: '', qty: 1, unit_price: 0, discount: 0, total: 0 }],
      tax: 0,
      discount: 0,
      additional_discount: 0,
      payment_method: 'cash',
      payment_id: '',
      payment_status: 'pending',
      amount_paid: '',
      notes: '',
      remarks: '',
      cash_amount: '',
      upi_amount: ''
    });
  };

  const handleCreateReceipt = async () => {
    if (!receiptForm.patient_id) {
      addToast('Please select a patient', 'error');
      return;
    }

    let receiptData = null; // Declare outside try block

    try {
      const { subtotal, taxAmount, total } = calculateTotals();

      receiptData = {
        patient_id: receiptForm.patient_id,
        // IMPORTANT: preserve appointment context if the user came from Queue/Prescription flow
        appointment_id: searchParams.get('appointment') ? parseInt(searchParams.get('appointment')) : null,
        clinic_id: clinicSettings?.id, // Include clinic_id
        // user.doctor_id is already correctly resolved at login for BOTH
        // 'doctor' and 'staff' roles (via the doctor_staff assignment table)
        // — restricting this to role==='doctor' meant every bill a staff
        // member created (the common case) got doctor_id=NULL, which
        // silently zeroed out that doctor's "Paid" KPI on the Queue dashboard.
        doctor_id: user?.doctor_id || null, // Use doctors table ID
        template_id: receiptForm.template_id || null, // Include template_id
        amount: subtotal,
        tax: taxAmount,
        discount: parseFloat(receiptForm.discount) || 0,
        additional_discount: parseFloat(receiptForm.additional_discount) || 0,
        total_amount: total,
        amount_paid: parseFloat(receiptForm.amount_paid) || 0,
        balance_due: Math.max(0, total - (parseFloat(receiptForm.amount_paid) || 0)),
        payment_method: receiptForm.payment_method,
        payment_id: receiptForm.payment_id || null,
        payment_status: receiptForm.payment_status || 'pending',
        ...(
          (receiptForm.payment_method === 'cash+upi' || receiptForm.payment_method === 'cash+card')
            ? {
                cash_component:  parseFloat(receiptForm.cash_amount) || 0,
                other_component: parseFloat(receiptForm.upi_amount)  || 0,
              }
            : {}
        ),
        notes: (receiptForm.payment_method === 'cash+upi' || receiptForm.payment_method === 'cash+card')
          ? `${receiptForm.notes || ''}${receiptForm.notes ? ' | ' : ''}Split: Cash ₹${receiptForm.cash_amount || 0} + ${receiptForm.payment_method === 'cash+upi' ? 'UPI' : 'Card'} ₹${receiptForm.upi_amount || 0}`
          : (receiptForm.notes || ''),
        remarks: receiptForm.remarks || '', // Include remarks (header content)
        service_items: receiptForm.services.map(s => ({
          ...s,
          qty: parseFloat(s.qty) || 1,
          unit_price: parseFloat(s.unit_price) || 0,
          amount: parseFloat(s.unit_price) || 0, // Add amount as fallback
          discount: parseFloat(s.discount) || 0,
          total: parseFloat(s.total) || 0,
          service_name: s.service_name || s.service || 'Service'
        }))
      };

      // console.log('🔍 DEBUG: Services being sent:', receiptData.service_items);
      // console.log('🔍 DEBUG: Original services form:', receiptForm.services);

      const res = await api.post('/api/bills', receiptData);

      // Get template data if template was selected
      const billId = res.data.bill_id || res.data.id;
      
      // Use the complete bill data from backend response, fallback to our form data
      let receiptWithTemplate = { 
        id: billId, 
        bill_id: billId,
        ...res.data.bill || res.data, // Use bill data from backend
        ...receiptData // Merge with our form data as fallback
      };

      // console.log('🔍 DEBUG: Backend response:', res.data);
      // console.log('🔍 DEBUG: Backend bill data:', res.data.bill);
      // console.log('🔍 DEBUG: Service items from backend:', res.data.bill?.service_items);
      // console.log('🔍 DEBUG: receiptWithTemplate after merge:', receiptWithTemplate);
      // console.log('🔍 DEBUG: Final service_items:', receiptWithTemplate.service_items);
      // console.log('🔍 DEBUG: Total amount:', receiptWithTemplate.total_amount);

      // console.log('🔍 DEBUG: receiptData.template_id =', receiptData.template_id);
      // console.log('🔍 DEBUG: receiptTemplates array =', receiptTemplates);

      if (receiptData.template_id) {
        const selectedTemplate = receiptTemplates.find(t => t.id === parseInt(receiptData.template_id));
        // console.log('🔍 DEBUG: selectedTemplate found =', selectedTemplate);

        if (selectedTemplate) {
          receiptWithTemplate = {
            ...receiptWithTemplate,
            template_header_image: selectedTemplate.header_image,
            template_header_content: selectedTemplate.header_content,
            template_footer_image: selectedTemplate.footer_image,
            template_footer_content: selectedTemplate.footer_content
          };
          // console.log('🔍 DEBUG: receiptWithTemplate after merge =', receiptWithTemplate);
        } else {
          console.warn('⚠️ Template not found! template_id:', receiptData.template_id, 'Available templates:', receiptTemplates.map(t => t.id));
        }
      }

      setSelectedReceipt(receiptWithTemplate);
      setShowCreateModal(false);
      setShowSuccessModal(true);
      
      // console.log('🔍 DEBUG: Receipt saved successfully:', receiptWithTemplate);
      // console.log('🔍 DEBUG: Service items in receipt:', receiptWithTemplate.service_items);
      // console.log('🔍 DEBUG: Services in receipt:', receiptWithTemplate.services);
      
      fetchReceipts();
      resetForm();
      addToast('Receipt created successfully', 'success');
    } catch (error) {
      console.error('Failed to create receipt:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error data sent:', receiptData);
      
      // Log validation details if available
      if (error.response?.data?.details) {
        console.error('Validation errors:', error.response.data.details);
        error.response.data.details.forEach((detail, index) => {
          console.error(`Validation error ${index + 1}:`, detail);
        });
      }
      
      // Show specific error message based on response
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create receipt';
      addToast(errorMessage, 'error');
    }
  };

  const selectedPatient = patients.find(p => p.id == receiptForm.patient_id);

  return (
    <div className="space-y-6 pt-2">

      {/* Search and Create Section */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">All Receipts</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowViewAllModal(true)}
              type="button"
              className="px-4 py-2 border rounded hover:bg-slate-50 transition active:scale-[0.98]"
            >
              View All Receipts
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              type="button"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition active:scale-[0.98]"
            >
              Create New Receipt
            </button>
          </div>
        </div>

        {/* Search Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by Name"
            className="px-3 py-2 border rounded"
            value={search.name}
            onChange={(e) => setSearch({ ...search, name: e.target.value })}
            autoComplete="off"
          />
          <input
            type="text"
            placeholder="Search by UHID"
            className="px-3 py-2 border rounded"
            value={search.uhid}
            onChange={(e) => setSearch({ ...search, uhid: e.target.value })}
            autoComplete="off"
          />
          <input
            type="text"
            placeholder="Search by Phone"
            className="px-3 py-2 border rounded"
            value={search.phone}
            onChange={(e) => setSearch({ ...search, phone: e.target.value })}
            autoComplete="off"
          />
        </div>

        <button
          onClick={handleSearch}
          type="button"
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition active:scale-[0.98]"
        >
          Search
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedReceipts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedReceipts.length} receipt{selectedReceipts.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
            >
              Delete Selected
            </button>
            <button
              onClick={() => {
                setSelectedReceipts([]);
                setSelectAll(false);
              }}
              className="px-3 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Receipts Table */}
      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">S NO.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">PATIENT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">SERVICE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">STATUS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">CREATED AT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">TOTAL AMOUNT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    No receipts found
                  </td>
                </tr>
              ) : (
                receipts.map((receipt, index) => (
                  <tr key={receipt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedReceipts.includes(receipt.id)}
                        onChange={() => handleSelectReceipt(receipt.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">{index + 1}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium">
                          {receipt.patient_name || `Unknown Patient (${receipt.patient_uhid || receipt.patient_id})`}
                        </div>
                        <div className="text-xs text-slate-500">{receipt.patient_uhid || receipt.patient_id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {receipt.service_items && receipt.service_items.length > 0
                        ? receipt.service_items.map(s => s.service_name || s.service).join(', ')
                        : 'Consultation'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => { const b = getPaymentStatusBadge(receipt.payment_status); return (
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${b.cls}`}>{b.label}</span>
                      ); })()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(receipt.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      ₹{formatCurrency(receipt.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              // Fetch full bill with service_items from API
                              const res = await api.get(`/api/bills/${receipt.id}`);
                              const fullBill = res.data?.bill || res.data;

                              // Add template data if receipt has template_id
                              let receiptWithTemplate = { ...fullBill };
                              if (fullBill.template_id) {
                                const template = receiptTemplates.find(t => t.id === parseInt(fullBill.template_id));
                                if (template) {
                                  receiptWithTemplate = {
                                    ...receiptWithTemplate,
                                    template_header_image: template.header_image,
                                    template_header_content: template.header_content,
                                    template_footer_image: template.footer_image,
                                    template_footer_content: template.footer_content
                                  };
                                }
                              }
                              setSelectedReceipt(receiptWithTemplate);
                              setShowSuccessModal(true);
                            } catch (error) {
                              console.error('Failed to fetch receipt details:', error);
                              addToast('Failed to load receipt details', 'error');
                            }
                          }}
                          className="text-primary hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => downloadBillingPDF(receipt.id)}
                          className="text-green-600 hover:underline flex items-center gap-1"
                          title="Download as PDF"
                        >
                          <FiDownload className="w-3 h-3" />
                          PDF
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              // Fetch full bill with service_items from API
                              const res = await api.get(`/api/bills/${receipt.id}`);
                              const fullBill = res.data?.bill || res.data;

                              // Prepare receipt for editing with proper service_items structure
                              let receiptForEdit = { ...fullBill };

                              // Ensure service_items exists and is properly formatted
                              if (!receiptForEdit.service_items || receiptForEdit.service_items.length === 0) {
                                const amt = parseFloat(fullBill.total_amount) || parseFloat(fullBill.subtotal) || parseFloat(fullBill.amount) || 0;
                                receiptForEdit.service_items = [{
                                  service_name: 'Consultation',
                                  qty: 1,
                                  unit_price: amt,
                                  discount: 0,
                                  total: amt
                                }];
                              } else {
                                // Ensure all numeric values are parsed
                                receiptForEdit.service_items = receiptForEdit.service_items.map(item => ({
                                  service_name: item.service_name || item.service || 'Service',
                                  qty: parseFloat(item.qty || item.quantity) || 1,
                                  unit_price: parseFloat(item.unit_price) || parseFloat(item.amount) || 0,
                                  discount: parseFloat(item.discount || item.discount_amount) || 0,
                                  total: parseFloat(item.total || item.total_price) || 0
                                }));
                              }

                              // Add template data if receipt has template_id
                              if (fullBill.template_id) {
                                const template = receiptTemplates.find(t => t.id === parseInt(fullBill.template_id));
                                if (template) {
                                  receiptForEdit = {
                                    ...receiptForEdit,
                                    template_header_image: template.header_image,
                                    template_header_content: template.header_content,
                                    template_footer_image: template.footer_image,
                                    template_footer_content: template.footer_content
                                  };
                                }
                              }

                              setEditingReceipt(receiptForEdit);
                              setShowEditModal(true);
                            } catch (error) {
                              console.error('Failed to fetch receipt for editing:', error);
                              addToast('Failed to load receipt details', 'error');
                            }
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm('Delete this receipt? This action cannot be undone.')) return;
                            try {
                              await api.delete(`/api/bills/${receipt.id}`);
                              await fetchReceipts();
                            } catch (err) {
                              console.error('Delete receipt failed:', err);
                              addToast('Failed to delete receipt', 'error');
                            }
                          }}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Receipt Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create Receipt"
      >
        <div className="space-y-6">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Patient *</label>
            {receiptForm.patient_id ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                <span className="text-sm text-blue-800">
                  <strong>Patient:</strong> {(patients.find(p => p.id == receiptForm.patient_id))?.name || 'Selected'}
                  {' - '}
                  {(patients.find(p => p.id == receiptForm.patient_id))?.patient_id || ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptForm({ ...receiptForm, patient_id: '' });
                    setPatientSearch('');
                    setPatientSearchResults([]);
                  }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Search by name, phone, or patient ID..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    searchPatientsForReceipt(e.target.value);
                  }}
                  autoComplete="off"
                />
                {patientSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border rounded shadow-lg">
                    {patientSearchResults.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setReceiptForm({ ...receiptForm, patient_id: patient.id });
                          setPatientSearch('');
                          setPatientSearchResults([]);
                          if (!patients.find(p => p.id === patient.id)) {
                            setPatients(prev => [...prev, patient]);
                          }
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                      >
                        <p className="font-medium text-sm">{patient.name}</p>
                        <p className="text-xs text-gray-500">
                          ID: {patient.patient_id} {patient.phone ? `• ${patient.phone}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Receipt Template (Optional)</label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-3 py-2 border rounded"
                value={receiptForm.template_id}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">No template (use clinic default)</option>
                {receiptTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} {template.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              {receiptForm.template_id && (
                <button
                  type="button"
                  onClick={() => handleTemplatePreview(receiptForm.template_id)}
                  className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                >
                  Preview
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select a template to add custom header/footer to this receipt
            </p>
          </div>

          {/* Patient Info Display */}
          {selectedPatient && (
            <div className="bg-slate-50 p-4 rounded grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500">Name</span>
                <p className="font-medium">{selectedPatient.name}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">UHID</span>
                <p className="font-medium">{selectedPatient.patient_id}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Phone</span>
                <p className="font-medium">{selectedPatient.phone || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Email</span>
                <p className="font-medium">{selectedPatient.email || '-'}</p>
              </div>
            </div>
          )}

          {/* Services Table */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className="block text-sm font-medium mr-auto">Services</label>
              {serviceGroups.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroupPopover(openGroupPopover === 'create' ? null : 'create')}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition flex items-center gap-1"
                  >
                    Groups
                    <span className="text-xs bg-purple-400 rounded-full px-1.5">{serviceGroups.length}</span>
                  </button>
                  {openGroupPopover === 'create' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenGroupPopover(null)} />
                      <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                        <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Service Groups</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1">
                          {serviceGroups.map(group => {
                            const svcList = Array.isArray(group.services) ? group.services : [];
                            return (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => {
                                  const newItems = svcList.map(s => ({ service_name: s.service_name, qty: 1, unit_price: parseFloat(s.unit_price) || 0, discount: 0, total: parseFloat(s.unit_price) || 0 }));
                                  setReceiptForm(prev => {
                                    const hasOnlyEmptyRow = prev.services.length === 1 && !prev.services[0].service_name && parseFloat(prev.services[0].unit_price || 0) === 0;
                                    return { ...prev, services: hasOnlyEmptyRow ? newItems : [...prev.services, ...newItems] };
                                  });
                                  addToast(`"${group.group_name}" added`, 'success');
                                  setOpenGroupPopover(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center justify-between group transition-colors"
                              >
                                <span>{group.group_name}</span>
                                <span className="text-xs text-gray-400 group-hover:text-purple-400">{svcList.length} svc</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => { setServicePickerTarget('create'); setShowServicePicker(true); setServiceSearchQuery(''); setSelectedServiceCategory(''); setServicePickerTab('services'); setShowGroupForm(false); }}
                className="px-3 py-1 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition"
              >
                + Add from Templates
              </button>
              <button
                type="button"
                onClick={addService}
                className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition active:scale-[0.98]"
              >
                + Add Blank
              </button>
            </div>
            <div className="border rounded overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">SERVICE</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">QTY</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">AMOUNT</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">DISCOUNT</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">TOTAL</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {receiptForm.services.map((service, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Service name"
                          value={service.service_name || service.service}
                          onChange={(e) => handleServiceChange(index, 'service_name', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-16 px-2 py-1 border rounded text-sm"
                          min="1"
                          value={service.qty}
                          onChange={(e) => handleServiceChange(index, 'qty', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-20 px-2 py-1 border rounded text-sm"
                          min="0"
                          step="0.01"
                          value={service.unit_price}
                          onChange={(e) => handleServiceChange(index, 'unit_price', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-20 px-2 py-1 border rounded text-sm"
                          min="0"
                          step="0.01"
                          value={service.discount}
                          onChange={(e) => handleServiceChange(index, 'discount', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">
                        ₹{formatCurrency(service.total)}
                      </td>
                      <td className="px-3 py-2">
                        {receiptForm.services.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeService(index)}
                            className="text-red-500 hover:text-red-700 transition active:scale-[0.98]"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 p-4 rounded space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tax (%)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="0.01"
                  value={receiptForm.tax}
                  onChange={(e) => setReceiptForm({ ...receiptForm, tax: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Line Item Discount</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="0.01"
                  value={receiptForm.discount}
                  onChange={(e) => setReceiptForm({ ...receiptForm, discount: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Additional Discount</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded"
                min="0"
                step="0.01"
                value={receiptForm.additional_discount}
                onChange={(e) => setReceiptForm({ ...receiptForm, additional_discount: e.target.value })}
              />
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Sub-Total:</span>
                <span>₹{formatCurrency(calculateTotals().subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span>₹{formatCurrency(calculateTotals().taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span>-₹{formatCurrency((parseFloat(receiptForm.discount) || 0) + (parseFloat(receiptForm.additional_discount) || 0))}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-1">
                <span>Grand Total:</span>
                <span>₹{formatCurrency(calculateTotals().total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method & Payment ID */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={receiptForm.payment_method}
                  onChange={(e) => setReceiptForm({ ...receiptForm, payment_method: e.target.value, cash_amount: '', upi_amount: '' })}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash+upi">Cash + UPI (Split)</option>
                  <option value="cash+card">Cash + Card (Split)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment ID / Transaction Ref</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., TXN123456 or UPI/12345"
                  value={receiptForm.payment_id}
                  onChange={(e) => setReceiptForm({ ...receiptForm, payment_id: e.target.value })}
                />
              </div>
            </div>
            {/* Split Payment Fields */}
            {(receiptForm.payment_method === 'cash+upi' || receiptForm.payment_method === 'cash+card') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 mb-2">Split Payment Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cash Amount (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="0"
                      min="0"
                      value={receiptForm.cash_amount}
                      onChange={(e) => {
                        const cashAmt = e.target.value;
                        const { total } = calculateTotals();
                        const otherAmt = Math.max(0, total - (parseFloat(cashAmt) || 0));
                        setReceiptForm(prev => ({ ...prev, cash_amount: cashAmt, upi_amount: otherAmt.toFixed(2) }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {receiptForm.payment_method === 'cash+upi' ? 'UPI' : 'Card'} Amount (₹)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="0"
                      min="0"
                      value={receiptForm.upi_amount}
                      onChange={(e) => {
                        const upiAmt = e.target.value;
                        const { total } = calculateTotals();
                        const cashAmt = Math.max(0, total - (parseFloat(upiAmt) || 0));
                        setReceiptForm(prev => ({ ...prev, upi_amount: upiAmt, cash_amount: cashAmt.toFixed(2) }));
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Status + Amount Paid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Payment Status</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={receiptForm.payment_status || 'pending'}
                onChange={(e) => setReceiptForm({ ...receiptForm, payment_status: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount Paid (₹)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={receiptForm.amount_paid || ''}
                onChange={(e) => {
                  const paid = parseFloat(e.target.value) || 0;
                  const { total } = calculateTotals();
                  let autoStatus = receiptForm.payment_status;
                  if (paid >= total && total > 0) autoStatus = 'paid';
                  else if (paid > 0 && paid < total) autoStatus = 'partial';
                  else if (paid === 0) autoStatus = 'pending';
                  setReceiptForm({ ...receiptForm, amount_paid: e.target.value, payment_status: autoStatus });
                }}
              />
              {(() => {
                const { total } = calculateTotals();
                const paid = parseFloat(receiptForm.amount_paid) || 0;
                const remaining = Math.max(0, total - paid);
                return remaining > 0 && paid > 0 ? (
                  <p className="text-xs text-orange-600 mt-1">Remaining: ₹{remaining.toFixed(2)}</p>
                ) : null;
              })()}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium mb-2">Remarks / Notes</label>
            <textarea
              className="w-full px-3 py-2 border rounded"
              rows="3"
              placeholder="Add any additional remarks or notes for this receipt..."
              value={receiptForm.remarks}
              onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateReceipt}
              disabled={!receiptForm.patient_id}
              className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
            >
              Create Receipt
            </button>
          </div>
        </div>
      </Modal>

      {/* Receipt Success/View Modal - UPDATED with dynamic clinic info */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title=""
        size="lg"
      >
        {selectedReceipt && (() => {
          // Get dynamic clinic info
          const clinic = getClinicInfo(selectedReceipt);
          
          return (
            <div className="space-y-6">
              {/* Success Message - only show for new receipts */}
              {selectedReceipt.justCreated !== false && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-green-600">Receipt Created Successfully!</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Receipt for ₹{formatCurrency(selectedReceipt.total_amount)} created successfully
                  </p>
                </div>
              )}

              {/* Receipt Preview with DYNAMIC Clinic Header */}
              <div className="border rounded p-6 bg-white" ref={printRef}>
                {/* Template Header Image */}
                {selectedReceipt.template_header_image && (
                  <div className="mb-4 text-center">
                    <img
                      src={selectedReceipt.template_header_image}
                      alt="Header"
                      className="max-w-full h-auto max-h-32 mx-auto"
                    />
                  </div>
                )}

                {/* Template Header Content */}
                {selectedReceipt.template_header_content && (
                  <div className="mb-4 pb-4 border-b">
                    <div
                      className="text-sm text-slate-700"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedReceipt.template_header_content) }}
                    />
                  </div>
                )}

                {/* Clinic Header - Only show if no template header */}
                {!selectedReceipt.template_header_image && (
                  <div className="text-center mb-6 pb-4 border-b">
                    {clinic.logo && (
                      <img
                        src={clinic.logo}
                        alt={clinic.name}
                        className="h-16 mx-auto mb-2 object-contain"
                      />
                    )}
                    <h4 className="text-xl font-bold text-slate-800">{clinic.name}</h4>
                    {formatAddress(clinic) && (
                      <p className="text-sm text-slate-600">{formatAddress(clinic)}</p>
                    )}
                    {(clinic.phone || clinic.email) && (
                      <p className="text-sm text-slate-600">
                        {clinic.phone && `Phone: ${clinic.phone}`}
                        {clinic.phone && clinic.email && ' | '}
                        {clinic.email && `Email: ${clinic.email}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Receipt Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h5 className="font-semibold text-slate-800">RECEIPT</h5>
                    <p className="text-sm text-slate-600">Receipt #: REC{String(selectedReceipt.id).padStart(4, '0')}</p>
                    <p className="text-sm text-slate-600">
                      Date: {new Date(selectedReceipt.created_at || new Date()).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Billed To:</p>
                    <p className="font-medium">
                      {selectedReceipt.patient_name || `Unknown Patient (${selectedReceipt.patient_uhid || selectedReceipt.patient_id})`}
                    </p>
                    <p className="text-sm text-slate-600">
                      UHID: {selectedReceipt.patient_uhid || selectedReceipt.patient_id}
                    </p>
                    <p className="text-sm text-slate-600">
                      Phone: {selectedReceipt.patient_phone || '-'}
                    </p>
                  </div>
                </div>

                {/* Services Table */}
                <table className="w-full text-sm mb-4 border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">S.No</th>
                      <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Service</th>
                      <th className="border border-slate-300 px-3 py-2 text-center font-semibold">Qty</th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="border border-slate-300 px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReceipt.service_items || []).length > 0 ? (
                      selectedReceipt.service_items.map((service, index) => (
                        <tr key={index}>
                          <td className="border border-slate-300 px-3 py-2">{index + 1}</td>
                          <td className="border border-slate-300 px-3 py-2">{service.service_name || 'Service'}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{service.qty || service.quantity || 1}</td>
                          <td className="border border-slate-300 px-3 py-2 text-right">₹{formatCurrency(service.unit_price)}</td>
                          <td className="border border-slate-300 px-3 py-2 text-right">₹{formatCurrency(service.total || service.total_price)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="border border-slate-300 px-3 py-2">1</td>
                        <td className="border border-slate-300 px-3 py-2">Consultation</td>
                        <td className="border border-slate-300 px-3 py-2 text-center">1</td>
                        <td className="border border-slate-300 px-3 py-2 text-right">₹{formatCurrency(selectedReceipt.total_amount || selectedReceipt.subtotal || selectedReceipt.amount)}</td>
                        <td className="border border-slate-300 px-3 py-2 text-right">₹{formatCurrency(selectedReceipt.total_amount || selectedReceipt.subtotal || selectedReceipt.amount)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-4">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sub-Total:</span>
                      <span>₹{formatCurrency(selectedReceipt.subtotal || selectedReceipt.total_amount || selectedReceipt.amount)}</span>
                    </div>
                    {parseFloat(selectedReceipt.tax) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Tax:</span>
                        <span>₹{formatCurrency(selectedReceipt.tax)}</span>
                      </div>
                    )}
                    {parseFloat(selectedReceipt.discount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Discount:</span>
                        <span>-₹{formatCurrency(selectedReceipt.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Grand Total:</span>
                      <span>₹{formatCurrency(selectedReceipt.total_amount)}</span>
                    </div>
                    {/* Partial payment breakdown - prominently in totals */}
                    {selectedReceipt.payment_status === 'partial' && (
                      <>
                        <div className="flex justify-between text-sm text-green-700 font-medium border-t pt-1">
                          <span>✓ Amount Paid:</span>
                          <span>₹{formatCurrency(selectedReceipt.amount_paid)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          <span>⚠ Balance Due:</span>
                          <span>₹{formatCurrency(selectedReceipt.balance_due || (parseFloat(selectedReceipt.total_amount) - parseFloat(selectedReceipt.amount_paid)))}</span>
                        </div>
                      </>
                    )}
                    {['paid','completed'].includes(selectedReceipt.payment_status) && parseFloat(selectedReceipt.amount_paid) > 0 && (
                      <div className="flex justify-between text-sm text-green-700 font-medium border-t pt-1">
                        <span>✓ Amount Paid:</span>
                        <span>₹{formatCurrency(selectedReceipt.amount_paid)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="font-medium">Payment Method:</span>
                      <span className="ml-2 capitalize">{selectedReceipt.payment_method || 'Cash'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 font-medium ${
                        ['paid','completed'].includes(selectedReceipt.payment_status) ? 'text-green-600' :
                        selectedReceipt.payment_status === 'partial' ? 'text-yellow-600' :
                        ['cancelled','failed'].includes(selectedReceipt.payment_status) ? 'text-red-600' : 'text-orange-600'
                      }`}>{getPaymentStatusBadge(selectedReceipt.payment_status).label}</span>
                    </div>
                  </div>
                  {selectedReceipt.payment_id && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">Payment ID:</span>
                      <span className="ml-2">{selectedReceipt.payment_id}</span>
                    </div>
                  )}
                  {selectedReceipt.remarks && (
                    <div className="text-sm bg-slate-50 p-3 rounded">
                      <span className="font-medium">Remarks:</span>
                      <p className="mt-1 text-slate-600">{selectedReceipt.remarks}</p>
                    </div>
                  )}
                </div>

                {/* Template Footer Content */}
                {selectedReceipt.template_footer_content && (
                  <div className="mt-6 pt-4 border-t">
                    <div
                      className="text-sm text-slate-600 text-center"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedReceipt.template_footer_content) }}
                    />
                  </div>
                )}

                {/* Template Footer Image */}
                {selectedReceipt.template_footer_image && (
                  <div className="mt-4 text-center">
                    <img
                      src={selectedReceipt.template_footer_image}
                      alt="Footer"
                      className="max-w-full h-auto max-h-24 mx-auto"
                    />
                  </div>
                )}

                {/* Default Footer (if no template footer) */}
                {!selectedReceipt.template_footer_content && !selectedReceipt.template_footer_image && (
                  <div className="text-center mt-6 pt-4 border-t text-xs text-slate-500">
                    <p>Thank you for choosing {clinic.name}</p>
                    <p>This is a computer generated receipt</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3 print:hidden">
                <button
                  onClick={() => {
                    // Prepare receipt for editing with proper service_items structure
                    let receiptForEdit = { ...selectedReceipt };

                    // Ensure service_items exists and is properly formatted
                    if (!receiptForEdit.service_items || receiptForEdit.service_items.length === 0) {
                      const amt = parseFloat(selectedReceipt.total_amount) || parseFloat(selectedReceipt.subtotal) || parseFloat(selectedReceipt.amount) || 0;
                      receiptForEdit.service_items = [{
                        service_name: 'Consultation',
                        qty: 1,
                        unit_price: amt,
                        discount: 0,
                        total: amt
                      }];
                    } else {
                      // Ensure all numeric values are parsed
                      receiptForEdit.service_items = receiptForEdit.service_items.map(item => ({
                        service_name: item.service_name || item.service || 'Service',
                        qty: parseFloat(item.quantity) || parseFloat(item.qty) || 1,
                        unit_price: parseFloat(item.unit_price) || parseFloat(item.amount) || 0,
                        discount: parseFloat(item.discount_amount) || parseFloat(item.discount) || 0,
                        total: parseFloat(item.total_price) || parseFloat(item.total) || 0
                      }));
                    }

                    setEditingReceipt(receiptForEdit);
                    setShowSuccessModal(false);
                    setShowEditModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Receipt
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const email = selectedReceipt.patient_email || selectedReceipt.email;
                    if (email) {
                      try {
                        await api.post('/api/notify/receipt', {
                          billId: selectedReceipt.id,
                          email: email,
                          method: 'email'
                        });
                        addToast('Receipt sent via email', 'success');
                      } catch {
                        addToast('Failed to send receipt', 'error');
                      }
                    } else {
                      addToast('Patient email not available', 'error');
                    }
                  }}
                  className="px-4 py-2 border rounded hover:bg-slate-50 flex items-center justify-center gap-2 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 border rounded hover:bg-slate-50 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedReceipt?.id) {
                      addToast('Receipt ID not available. Please try again.', 'error');
                      return;
                    }
                    try {
                      const response = await api.get(`/api/pdf/bill/${selectedReceipt.id}`, {
                        responseType: 'blob'
                      });

                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `receipt-${selectedReceipt.id}.pdf`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('PDF download error:', error);
                      addToast('Failed to download PDF', 'error');
                    }
                  }}
                  className="px-4 py-2 border rounded hover:bg-slate-50 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={async () => {
                    if (!selectedReceipt?.id) {
                      addToast('Receipt ID not available. Please try again.', 'error');
                      return;
                    }
                    try {
                      const response = await api.get(`/api/bills/${selectedReceipt.id}/whatsapp`);
                      if (response.data && response.data.success) {
                        const { patient_phone, whatsapp_message, pdf_url } = response.data;
                        const phone = (patient_phone || '').replace(/\D/g, '');
                        const message = whatsapp_message || (pdf_url ? `Your receipt: ${pdf_url}` : 'Your receipt is ready.');
                        if (phone) {
                          openWhatsApp(phone, message);
                        } else {
                          const shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                          window.open(shareUrl, '_blank');
                        }
                      } else {
                        const link = `${window.location.origin.replace(/\/$/, '')}/api/pdf/bill/${selectedReceipt.id}`;
                        const msg = `Your receipt: ${link}`;
                        const shareUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                        window.open(shareUrl, '_blank');
                      }
                    } catch (error) {
                      console.error('Failed to prepare bill for WhatsApp:', error);
                      addToast('Failed to prepare bill for WhatsApp. Please try again.', 'error');
                    }
                  }}
                  className="px-4 py-2 border rounded hover:bg-slate-50 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                  title="Send bill via WhatsApp"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Send Bill
                </button>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-4 border-t print:hidden">
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition active:scale-[0.98]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    setShowCreateModal(true);
                  }}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition active:scale-[0.98]"
                >
                  Create New Receipt
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* View All Receipts Modal */}
      <Modal
        isOpen={showViewAllModal}
        onClose={() => setShowViewAllModal(false)}
        title="All Receipts"
        size="xl"
      >
        <div className="space-y-4">
          {/* Search Fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search by Name"
              className="px-3 py-2 border rounded"
              value={search.name}
              onChange={(e) => setSearch({ ...search, name: e.target.value })}
              autoComplete="off"
            />
            <input
              type="text"
              placeholder="Search by UHID"
              className="px-3 py-2 border rounded"
              value={search.uhid}
              onChange={(e) => setSearch({ ...search, uhid: e.target.value })}
              autoComplete="off"
            />
            <input
              type="text"
              placeholder="Search by Phone"
              className="px-3 py-2 border rounded"
              value={search.phone}
              onChange={(e) => setSearch({ ...search, phone: e.target.value })}
              autoComplete="off"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Search
            </button>
          </div>

          {/* Receipts Table */}
          <div className="border rounded overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">S NO.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">PATIENT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">SERVICE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">STATUS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">DATE</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">TOTAL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : receipts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      No receipts found
                    </td>
                  </tr>
                ) : (
                  receipts.map((receipt, index) => (
                    <tr key={receipt.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium">
                            {receipt.patient_name || `Unknown Patient (${receipt.patient_uhid || receipt.patient_id})`}
                          </div>
                          <div className="text-xs text-slate-500">{receipt.patient_uhid || receipt.patient_id}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {receipt.service_items && receipt.service_items.length > 0
                          ? receipt.service_items.map(s => s.service_name || s.service).join(', ')
                          : 'Consultation'
                        }
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(() => { const b = getPaymentStatusBadge(receipt.payment_status); return (
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${b.cls}`}>{b.label}</span>
                        ); })()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(receipt.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        ₹{formatCurrency(receipt.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                // Fetch full bill with service_items from API
                                const res = await api.get(`/api/bills/${receipt.id}`);
                                const fullBill = res.data?.bill || res.data;

                                // Add template data if receipt has template_id
                                let receiptWithTemplate = { ...fullBill, justCreated: false };
                                if (fullBill.template_id) {
                                  const template = receiptTemplates.find(t => t.id === parseInt(fullBill.template_id));
                                  if (template) {
                                    receiptWithTemplate = {
                                      ...receiptWithTemplate,
                                      template_header_image: template.header_image,
                                      template_header_content: template.header_content,
                                      template_footer_image: template.footer_image,
                                      template_footer_content: template.footer_content
                                    };
                                  }
                                }
                                setSelectedReceipt(receiptWithTemplate);
                                setShowViewAllModal(false);
                                setShowSuccessModal(true);
                              } catch (error) {
                                console.error('Failed to fetch receipt details:', error);
                                addToast('Failed to load receipt details', 'error');
                              }
                            }}
                            className="text-primary hover:underline"
                          >
                            View
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                // Fetch full bill with service_items from API
                                const res = await api.get(`/api/bills/${receipt.id}`);
                                const fullBill = res.data?.bill || res.data;

                                // Prepare receipt for editing with proper service_items structure
                                let receiptForEdit = { ...fullBill };

                                // Ensure service_items exists and is properly formatted
                                if (!receiptForEdit.service_items || receiptForEdit.service_items.length === 0) {
                                  const amt = parseFloat(fullBill.total_amount) || parseFloat(fullBill.subtotal) || parseFloat(fullBill.amount) || 0;
                                  receiptForEdit.service_items = [{
                                    service_name: 'Consultation',
                                    qty: 1,
                                    unit_price: amt,
                                    discount: 0,
                                    total: amt
                                  }];
                                } else {
                                  // Ensure all numeric values are parsed
                                  receiptForEdit.service_items = receiptForEdit.service_items.map(item => ({
                                    service_name: item.service_name || item.service || 'Service',
                                    qty: parseFloat(item.qty || item.quantity) || 1,
                                    unit_price: parseFloat(item.unit_price) || parseFloat(item.amount) || 0,
                                    discount: parseFloat(item.discount || item.discount_amount) || 0,
                                    total: parseFloat(item.total || item.total_price) || 0
                                  }));
                                }

                                // Add template data if receipt has template_id
                                if (fullBill.template_id) {
                                  const template = receiptTemplates.find(t => t.id === parseInt(fullBill.template_id));
                                  if (template) {
                                    receiptForEdit = {
                                      ...receiptForEdit,
                                      template_header_image: template.header_image,
                                      template_header_content: template.header_content,
                                      template_footer_image: template.footer_image,
                                      template_footer_content: template.footer_content
                                    };
                                  }
                                }

                                setEditingReceipt(receiptForEdit);
                                setShowViewAllModal(false);
                                setShowEditModal(true);
                              } catch (error) {
                                console.error('Failed to fetch receipt for editing:', error);
                                addToast('Failed to load receipt details', 'error');
                              }
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Delete this receipt? This action cannot be undone.')) return;
                              try {
                                await api.delete(`/api/bills/${receipt.id}`);
                                await fetchReceipts();
                              } catch (err) {
                                console.error('Delete receipt failed:', err);
                                addToast('Failed to delete receipt', 'error');
                              }
                            }}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => setShowViewAllModal(false)}
              className="px-4 py-2 border rounded hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Receipt Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Receipt"
      >
        {editingReceipt && (
          <div className="space-y-6">
            {(() => {
              // Ensure service_items always exist
              if (!editingReceipt.service_items || editingReceipt.service_items.length === 0) {
                editingReceipt.service_items = [{ service_name: '', qty: 1, unit_price: 0, discount_amount: 0, total_price: 0 }];
              }
              return null;
            })()}
            
            {/* Patient Info Display */}
            <div className="bg-slate-50 p-4 rounded grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500">Name</span>
                <p className="font-medium">
                  {editingReceipt.patient_name || `Unknown Patient (${editingReceipt.patient_uhid || editingReceipt.patient_id})`}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">UHID</span>
                <p className="font-medium">{editingReceipt.patient_uhid || editingReceipt.patient_id}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Phone</span>
                <p className="font-medium">{editingReceipt.patient_phone || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Receipt ID</span>
                <p className="font-medium">REC{String(editingReceipt.id).padStart(4, '0')}</p>
              </div>
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Receipt Template (Optional)</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 border rounded"
                  value={editingReceipt.template_id || ''}
                  onChange={(e) => {
                    const templateId = e.target.value;
                    const selectedTemplate = receiptTemplates.find(t => t.id === parseInt(templateId));

                    if (selectedTemplate) {
                      setEditingReceipt({
                        ...editingReceipt,
                        template_id: templateId,
                        notes: selectedTemplate.footer_content || '',
                        remarks: selectedTemplate.header_content || ''
                      });
                    } else {
                      setEditingReceipt({
                        ...editingReceipt,
                        template_id: '',
                        notes: '',
                        remarks: ''
                      });
                    }
                  }}
                >
                  <option value="">No template (use clinic default)</option>
                  {receiptTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.template_name} {template.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                {editingReceipt.template_id && (
                  <button
                    type="button"
                    onClick={() => handleTemplatePreview(editingReceipt.template_id)}
                    className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
                  >
                    Preview
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Select a template to add custom header/footer to this receipt
              </p>
            </div>

            {/* Services Table */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="block text-sm font-medium mr-auto">Services</label>
                {serviceGroups.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenGroupPopover(openGroupPopover === 'edit' ? null : 'edit')}
                      className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition flex items-center gap-1"
                    >
                      Groups
                      <span className="text-xs bg-purple-400 rounded-full px-1.5">{serviceGroups.length}</span>
                    </button>
                    {openGroupPopover === 'edit' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenGroupPopover(null)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                          <div className="max-h-64 overflow-y-auto py-1">
                            {serviceGroups.map(group => {
                              const svcList = Array.isArray(group.services) ? group.services : [];
                              return (
                                <button
                                  key={group.id}
                                  type="button"
                                  onClick={() => {
                                    const newItems = svcList.map(s => ({ service_name: s.service_name, qty: 1, unit_price: parseFloat(s.unit_price) || 0, discount: 0, total: parseFloat(s.unit_price) || 0 }));
                                    const updatedReceipt = { ...editingReceipt };
                                    if (!updatedReceipt.service_items) updatedReceipt.service_items = [];
                                    const hasOnlyEmptyRow = updatedReceipt.service_items.length === 1 && !updatedReceipt.service_items[0].service_name && parseFloat(updatedReceipt.service_items[0].unit_price || 0) === 0;
                                    updatedReceipt.service_items = hasOnlyEmptyRow ? newItems : [...updatedReceipt.service_items, ...newItems];
                                    setEditingReceipt(updatedReceipt);
                                    addToast(`"${group.group_name}" added`, 'success');
                                    setOpenGroupPopover(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition"
                                >
                                  {group.group_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                  <button
                    type="button"
                    onClick={() => { setServicePickerTarget('edit'); setShowServicePicker(true); setServiceSearchQuery(''); setSelectedServiceCategory(''); setServicePickerTab('services'); setShowGroupForm(false); }}
                    className="px-3 py-1 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition"
                  >
                    + Add from Templates
                  </button>
                  <button
                    onClick={() => {
                      const updatedReceipt = { ...editingReceipt };
                      if (!updatedReceipt.service_items) updatedReceipt.service_items = [];
                      updatedReceipt.service_items.push({ service: '', qty: 1, amount: 0, discount: 0, total: 0 });
                      setEditingReceipt(updatedReceipt);
                    }}
                    className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                  >
                    + Add Blank
                  </button>
              </div>
              <div className="border rounded overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">SERVICE</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">QTY</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">AMOUNT</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">DISCOUNT</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">TOTAL</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(editingReceipt.service_items && editingReceipt.service_items.length > 0) ? (
                      editingReceipt.service_items.map((service, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              className="w-full px-2 py-1 border rounded text-sm"
                              placeholder="Service name"
                              value={service.service_name || service.service}
                            onChange={(e) => {
                              const updatedReceipt = { ...editingReceipt };
                              updatedReceipt.service_items[index].service_name = e.target.value;
                              setEditingReceipt(updatedReceipt);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className="w-16 px-2 py-1 border rounded text-sm"
                            min="1"
                            value={service.qty ?? service.quantity ?? 1}
                            onChange={(e) => {
                              const updatedReceipt = { ...editingReceipt };
                              const qty = parseFloat(e.target.value) || 1;
                              const amount = parseFloat(service.unit_price ?? service.amount) || 0;
                              const discount = parseFloat(service.discount ?? service.discount_amount) || 0;
                              updatedReceipt.service_items[index].qty = qty;
                              updatedReceipt.service_items[index].quantity = qty;
                              updatedReceipt.service_items[index].total = (qty * amount) - discount;
                              updatedReceipt.service_items[index].total_price = (qty * amount) - discount;
                              setEditingReceipt(updatedReceipt);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className="w-20 px-2 py-1 border rounded text-sm"
                            min="0"
                            step="0.01"
                            value={service.unit_price ?? service.amount ?? 0}
                            onChange={(e) => {
                              const updatedReceipt = { ...editingReceipt };
                              const qty = parseFloat(service.qty ?? service.quantity) || 1;
                              const amount = parseFloat(e.target.value) || 0;
                              const discount = parseFloat(service.discount ?? service.discount_amount) || 0;
                              updatedReceipt.service_items[index].unit_price = amount;
                              updatedReceipt.service_items[index].amount = amount;
                              updatedReceipt.service_items[index].total = (qty * amount) - discount;
                              updatedReceipt.service_items[index].total_price = (qty * amount) - discount;
                              setEditingReceipt(updatedReceipt);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className="w-20 px-2 py-1 border rounded text-sm"
                            min="0"
                            step="0.01"
                            value={service.discount ?? service.discount_amount ?? 0}
                            onChange={(e) => {
                              const updatedReceipt = { ...editingReceipt };
                              const qty = parseFloat(service.qty ?? service.quantity) || 1;
                              const amount = parseFloat(service.unit_price ?? service.amount) || 0;
                              const discount = parseFloat(e.target.value) || 0;
                              updatedReceipt.service_items[index].discount = discount;
                              updatedReceipt.service_items[index].discount_amount = discount;
                              updatedReceipt.service_items[index].total = (qty * amount) - discount;
                              updatedReceipt.service_items[index].total_price = (qty * amount) - discount;
                              setEditingReceipt(updatedReceipt);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-medium">
                          ₹{formatCurrency(service.total ?? service.total_price ?? 0)}
                        </td>
                        <td className="px-3 py-2">
                          {(editingReceipt.service_items || []).length > 1 && (
                            <button
                              onClick={() => {
                                const updatedReceipt = { ...editingReceipt };
                                updatedReceipt.service_items.splice(index, 1);
                                setEditingReceipt(updatedReceipt);
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-3 py-4 text-center text-slate-500">
                          No services added. Use the "Add Service" button to add items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 p-4 rounded space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tax (%)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded"
                    min="0"
                    step="0.01"
                    value={editingReceipt.tax || 0}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, tax: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded"
                    min="0"
                    step="0.01"
                    value={editingReceipt.discount || 0}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, discount: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="border-t pt-2 space-y-1">
                {(() => {
                  const subtotal = (editingReceipt.service_items || []).reduce((sum, s) => sum + (parseFloat(s.total ?? s.total_price) || 0), 0);
                  const taxAmount = (subtotal * (parseFloat(editingReceipt.tax) || 0)) / 100;
                  const totalDiscount = parseFloat(editingReceipt.discount) || 0;
                  const grandTotal = subtotal + taxAmount - totalDiscount;
                  
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Sub-Total:</span>
                        <span>₹{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax:</span>
                        <span>₹{formatCurrency(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Discount:</span>
                        <span>-₹{formatCurrency(totalDiscount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t pt-1">
                        <span>Grand Total:</span>
                        <span>₹{formatCurrency(grandTotal)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Payment Method & Payment ID */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Method</label>
                  <select
                    className="w-full px-3 py-2 border rounded"
                    value={editingReceipt.payment_method || 'cash'}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, payment_method: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash+upi">Cash + UPI (Split)</option>
                    <option value="cash+card">Cash + Card (Split)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Payment ID / Transaction Ref</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    placeholder="e.g., TXN123456 or UPI/12345"
                    value={editingReceipt.payment_id || ''}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, payment_id: e.target.value })}
                  />
                </div>
              </div>
              {(editingReceipt.payment_method === 'cash+upi' || editingReceipt.payment_method === 'cash+card') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Split Payment Breakdown</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cash Amount (₹)</label>
                      <input type="number" className="w-full px-3 py-2 border rounded text-sm" placeholder="0" min="0"
                        value={editingReceipt.cash_amount || ''}
                        onChange={(e) => {
                          const cashAmt = e.target.value;
                          const totalAmt = parseFloat(editingReceipt.total_amount) || 0;
                          const otherAmt = Math.max(0, totalAmt - (parseFloat(cashAmt) || 0));
                          setEditingReceipt(prev => ({ ...prev, cash_amount: cashAmt, upi_amount: otherAmt.toFixed(2) }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {editingReceipt.payment_method === 'cash+upi' ? 'UPI' : 'Card'} Amount (₹)
                      </label>
                      <input type="number" className="w-full px-3 py-2 border rounded text-sm" placeholder="0" min="0"
                        value={editingReceipt.upi_amount || ''}
                        onChange={(e) => {
                          const upiAmt = e.target.value;
                          const totalAmt = parseFloat(editingReceipt.total_amount) || 0;
                          const cashAmt = Math.max(0, totalAmt - (parseFloat(upiAmt) || 0));
                          setEditingReceipt(prev => ({ ...prev, upi_amount: upiAmt, cash_amount: cashAmt.toFixed(2) }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Status + Amount Paid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Status</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={editingReceipt.payment_status || 'pending'}
                  onChange={(e) => setEditingReceipt({ ...editingReceipt, payment_status: e.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount Paid (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editingReceipt.amount_paid || ''}
                  onChange={(e) => {
                    const paid = parseFloat(e.target.value) || 0;
                    const total = parseFloat(editingReceipt.total_amount) || 0;
                    let autoStatus = editingReceipt.payment_status;
                    if (paid >= total && total > 0) autoStatus = 'paid';
                    else if (paid > 0 && paid < total) autoStatus = 'partial';
                    else if (paid === 0) autoStatus = 'pending';
                    setEditingReceipt({ ...editingReceipt, amount_paid: e.target.value, payment_status: autoStatus });
                  }}
                />
                {(() => {
                  const total = parseFloat(editingReceipt.total_amount) || 0;
                  const paid = parseFloat(editingReceipt.amount_paid) || 0;
                  const remaining = Math.max(0, total - paid);
                  return remaining > 0 ? (
                    <p className="text-xs text-orange-600 mt-1">Remaining: ₹{remaining.toFixed(2)}</p>
                  ) : paid > 0 ? (
                    <p className="text-xs text-green-600 mt-1">Fully Paid</p>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium mb-2">Remarks / Notes</label>
              <textarea
                className="w-full px-3 py-2 border rounded"
                rows="3"
                placeholder="Add any additional remarks or notes for this receipt..."
                value={editingReceipt.remarks || ''}
                onChange={(e) => setEditingReceipt({ ...editingReceipt, remarks: e.target.value })}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Calculate subtotal using both total and total_price fields
                    const subtotal = (editingReceipt.service_items || []).reduce((sum, s) => sum + (parseFloat(s.total || s.total_price || 0) || 0), 0);
                    const taxAmount = (subtotal * (parseFloat(editingReceipt.tax) || 0)) / 100;
                    const total = subtotal + taxAmount - (parseFloat(editingReceipt.discount) || 0);

                    const amountPaid = parseFloat(editingReceipt.amount_paid) || 0;
                    const updateData = {
                      template_id: editingReceipt.template_id ? parseInt(editingReceipt.template_id) : null,
                      amount: subtotal,
                      tax: parseFloat(editingReceipt.tax) || 0,
                      discount: parseFloat(editingReceipt.discount) || 0,
                      total_amount: total,
                      amount_paid: amountPaid,
                      balance_due: Math.max(0, total - amountPaid),
                      payment_method: editingReceipt.payment_method || 'cash',
                      payment_id: editingReceipt.payment_id || null,
                      payment_status: editingReceipt.payment_status || 'pending',
                      ...(
                        (editingReceipt.payment_method === 'cash+upi' || editingReceipt.payment_method === 'cash+card')
                          ? {
                              cash_component:  parseFloat(editingReceipt.cash_amount) || 0,
                              other_component: parseFloat(editingReceipt.upi_amount)  || 0,
                            }
                          : {}
                      ),
                      notes: editingReceipt.notes || null,
                      remarks: editingReceipt.remarks || null,
                      // Send service_items in the exact backend format
                      service_items: (editingReceipt.service_items || []).map(s => ({
                        service_name: s.service_name || s.service || '',
                        quantity: parseFloat(s.qty || s.quantity || 1) || 1,
                        unit_price: parseFloat(s.unit_price || s.amount || 0) || 0,
                        discount_amount: parseFloat(s.discount_amount || s.discount || 0) || 0,
                        total_price: parseFloat(s.total_price || s.total || 0) || 0
                      }))
                    };

                    const _res = await api.put(`/api/bills/${editingReceipt.id}`, updateData);

                    // Fetch receipts list to refresh the table
                    await fetchReceipts();

                    // Fetch the specific updated receipt with all template data from server
                    const res2 = await api.get(`/api/bills/${editingReceipt.id}`);
                    const updatedReceiptFromServer = res2.data.bill;

                    // Set the selected receipt with fresh data from server (includes template data)
                    setSelectedReceipt(updatedReceiptFromServer);
                    setShowEditModal(false);
                    setShowSuccessModal(true);
                  } catch (error) {
                    console.error('Failed to update receipt:', error);
                    addToast('Failed to update receipt: ' + (error.response?.data?.error || error.message), 'error');
                  }
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                Update Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Template Preview Modal */}
      <Modal
        isOpen={showTemplatePreview}
        onClose={() => setShowTemplatePreview(false)}
        title="Template Preview"
      >
        {previewingTemplate && (
          <div className="space-y-4">
            {/* Template Name */}
            <div className="pb-4 border-b">
              <h3 className="text-lg font-semibold">{previewingTemplate.template_name}</h3>
              {previewingTemplate.is_default && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 inline-block">
                  Default Template
                </span>
              )}
            </div>

            {/* Header Section */}
            {(previewingTemplate.header_image || previewingTemplate.header_content) && (
              <div className="border-b pb-4">
                <p className="text-sm font-medium mb-2 text-slate-700">Header:</p>
                {previewingTemplate.header_image && (
                  <div className="mb-3">
                    <img
                      src={previewingTemplate.header_image}
                      alt="Header"
                      className="max-w-full h-auto max-h-40 mx-auto border rounded"
                    />
                  </div>
                )}
                {previewingTemplate.header_content && (
                  <div className="bg-slate-50 p-3 rounded">
                    <div
                      className="text-sm text-slate-700"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewingTemplate.header_content) }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Footer Section */}
            {(previewingTemplate.footer_content || previewingTemplate.footer_image) && (
              <div className="border-b pb-4">
                <p className="text-sm font-medium mb-2 text-slate-700">Footer:</p>
                {previewingTemplate.footer_content && (
                  <div className="bg-slate-50 p-3 rounded mb-3">
                    <div
                      className="text-sm text-slate-700"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewingTemplate.footer_content) }}
                    />
                  </div>
                )}
                {previewingTemplate.footer_image && (
                  <div>
                    <img
                      src={previewingTemplate.footer_image}
                      alt="Footer"
                      className="max-w-full h-auto max-h-40 mx-auto border rounded"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTemplatePreview(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Service Picker Modal - Grouped, Searchable with CRUD + Groups */}
      {showServicePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Select Services</h2>
              <div className="flex items-center gap-2">
                {servicePickerTab === 'services' ? (
                  <button
                    type="button"
                    onClick={() => { setShowAddServiceForm(true); setNewServiceForm({ service_name: '', category: Object.keys(groupedServices)[0] || 'Other', default_price: 0 }); }}
                    className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                  >
                    + New Service
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupFormName(''); setGroupFormServices([]); }}
                    className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
                  >
                    + New Group
                  </button>
                )}
                <button onClick={() => { setShowServicePicker(false); setEditingService(null); setShowAddServiceForm(false); setShowGroupForm(false); }} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => { setServicePickerTab('services'); setShowGroupForm(false); }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${servicePickerTab === 'services' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => { setServicePickerTab('groups'); setShowAddServiceForm(false); }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${servicePickerTab === 'groups' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Groups
                {serviceGroups.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">{serviceGroups.length}</span>
                )}
              </button>
            </div>

            {/* Add New Service Form — only in services tab */}
            {servicePickerTab === 'services' && showAddServiceForm && (
              <div className="p-3 border-b bg-green-50">
                <p className="text-xs font-semibold text-green-800 mb-2">Add New Service</p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Name</label>
                    <input type="text" className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Service name"
                      value={newServiceForm.service_name} onChange={(e) => setNewServiceForm(prev => ({ ...prev, service_name: e.target.value }))} />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Category</label>
                    <select className="w-full px-2 py-1.5 border rounded text-xs" value={newServiceForm.category}
                      onChange={(e) => setNewServiceForm(prev => ({ ...prev, category: e.target.value }))}>
                      {Object.keys(groupedServices).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new">+ New Category</option>
                    </select>
                  </div>
                  {newServiceForm.category === '__new' && (
                    <div className="w-28">
                      <label className="block text-[10px] text-gray-500 mb-0.5">New Category</label>
                      <input type="text" className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Category"
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, category: e.target.value }))} />
                    </div>
                  )}
                  <div className="w-24">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Price (₹)</label>
                    <input type="number" className="w-full px-2 py-1.5 border rounded text-xs" min="0"
                      value={newServiceForm.default_price} onChange={(e) => setNewServiceForm(prev => ({ ...prev, default_price: e.target.value }))} />
                  </div>
                  <button type="button" onClick={async () => {
                    if (!newServiceForm.service_name.trim() || !newServiceForm.category.trim()) { addToast('Name and category required', 'error'); return; }
                    try {
                      await api.post('/api/bills/services', newServiceForm);
                      addToast('Service added!', 'success');
                      setShowAddServiceForm(false);
                      fetchServices();
                    } catch (err) { addToast('Failed to add service', 'error'); }
                  }} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">Add</button>
                  <button type="button" onClick={() => setShowAddServiceForm(false)} className="px-2 py-1.5 border rounded text-xs hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            )}

            {/* Search — only in services tab */}
            {servicePickerTab === 'services' && <div className="p-3 border-b space-y-2">
              <input type="text" autoComplete="off" className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                placeholder="Search services..." value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)} autoFocus />
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setSelectedServiceCategory('')}
                  className={`px-2.5 py-1 text-xs rounded-full border transition ${!selectedServiceCategory ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-purple-50 border-gray-300'}`}>All</button>
                {Object.keys(groupedServices).map(cat => (
                  <button key={cat} type="button" onClick={() => setSelectedServiceCategory(cat)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition ${selectedServiceCategory === cat ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-purple-50 border-gray-300'}`}>
                    {cat} ({groupedServices[cat].length})
                  </button>
                ))}
              </div>
            </div>}

            {/* Services List — services tab */}
            {servicePickerTab === 'services' && <div className="overflow-y-auto flex-1 p-4">
              {(selectedServiceCategory ? [selectedServiceCategory] : Object.keys(groupedServices)).map(category => {
                const services = (groupedServices[category] || []).filter(s =>
                  !serviceSearchQuery || s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                );
                if (services.length === 0) return null;
                return (
                  <div key={category} className="mb-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {services.map(s => (
                        <div key={s.id || s.name} className="relative group">
                          {/* Edit mode for this service */}
                          {editingService && editingService.id === s.id ? (
                            <div className="p-2 border-2 border-purple-400 rounded bg-purple-50 space-y-1">
                              <input type="text" className="w-full px-2 py-1 border rounded text-xs" value={editingService.name}
                                onChange={(e) => setEditingService(prev => ({ ...prev, name: e.target.value }))} />
                              <div className="flex gap-1">
                                <input type="number" className="w-20 px-2 py-1 border rounded text-xs" min="0" value={editingService.price}
                                  onChange={(e) => setEditingService(prev => ({ ...prev, price: e.target.value }))} />
                                <select className="flex-1 px-1 py-1 border rounded text-xs" value={editingService.category}
                                  onChange={(e) => setEditingService(prev => ({ ...prev, category: e.target.value }))}>
                                  {Object.keys(groupedServices).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <button type="button" onClick={async () => {
                                  try {
                                    await api.put(`/api/bills/services/${editingService.id}`, {
                                      service_name: editingService.name, category: editingService.category,
                                      default_price: parseFloat(editingService.price) || 0
                                    });
                                    addToast('Service updated', 'success');
                                    setEditingService(null);
                                    fetchServices();
                                  } catch (err) { addToast('Failed to update', 'error'); }
                                }} className="px-2 py-0.5 bg-purple-600 text-white rounded text-[10px]">Save</button>
                                <button type="button" onClick={() => setEditingService(null)}
                                  className="px-2 py-0.5 border rounded text-[10px]">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const newItem = { service_name: s.name, qty: 1, unit_price: parseFloat(s.price) || 0, discount: 0, total: parseFloat(s.price) || 0 };
                                if (servicePickerTarget === 'edit') {
                                  const updatedReceipt = { ...editingReceipt };
                                  if (!updatedReceipt.service_items) updatedReceipt.service_items = [];
                                  // Replace empty default row if it exists
                                  const hasOnlyEmptyRow = updatedReceipt.service_items.length === 1 && !updatedReceipt.service_items[0].service_name && parseFloat(updatedReceipt.service_items[0].unit_price || 0) === 0;
                                  if (hasOnlyEmptyRow) {
                                    updatedReceipt.service_items = [newItem];
                                  } else {
                                    updatedReceipt.service_items.push(newItem);
                                  }
                                  setEditingReceipt(updatedReceipt);
                                } else {
                                  setReceiptForm(prev => {
                                    // Replace empty default row if it exists
                                    const hasOnlyEmptyRow = prev.services.length === 1 && !prev.services[0].service_name && parseFloat(prev.services[0].unit_price || 0) === 0;
                                    if (hasOnlyEmptyRow) {
                                      return { ...prev, services: [newItem] };
                                    }
                                    return { ...prev, services: [...prev.services, newItem] };
                                  });
                                }
                                addToast(`${s.name} added`, 'success');
                              }}
                              className="w-full flex items-center justify-between p-2 border rounded text-sm hover:bg-purple-50 hover:border-purple-300 transition text-left"
                            >
                              <span className="font-medium text-xs">{s.name}</span>
                              <span className="text-xs text-gray-500 ml-2">₹{parseFloat(s.price || 0).toFixed(0)}</span>
                            </button>
                          )}
                          {/* Edit/Delete icons on hover */}
                          {!editingService && (
                            <div className="absolute top-0 right-0 hidden group-hover:flex gap-0.5 bg-white rounded-bl shadow-sm border p-0.5">
                              <button type="button" title="Edit" onClick={(e) => { e.stopPropagation(); setEditingService({ ...s }); }}
                                className="p-0.5 text-gray-400 hover:text-blue-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button type="button" title="Delete" onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Delete "${s.name}"?`)) return;
                                try {
                                  await api.delete(`/api/bills/services/${s.id}`);
                                  addToast('Service deleted', 'success');
                                  fetchServices();
                                } catch (err) { addToast('Failed to delete', 'error'); }
                              }} className="p-0.5 text-gray-400 hover:text-red-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>}

            {/* Groups Tab Content */}
            {servicePickerTab === 'groups' && (
              <div className="overflow-y-auto flex-1 p-4">
                {/* Create/Edit Group Form */}
                {showGroupForm && (
                  <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm font-semibold text-purple-800 mb-3">
                      {editingGroup ? 'Edit Group' : 'Create New Group'}
                    </p>
                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 mb-1">Group Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                        placeholder="e.g., Diabetes Package, OPD Combo"
                        value={groupFormName}
                        onChange={(e) => setGroupFormName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 mb-1">Add Services to Group</label>
                      <div className="max-h-48 overflow-y-auto border rounded bg-white divide-y">
                        {allServices.map(s => {
                          const inGroup = groupFormServices.some(g => g.service_name === s.name);
                          return (
                            <label key={s.id || s.name} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-purple-50 text-sm ${inGroup ? 'bg-purple-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={inGroup}
                                onChange={() => {
                                  if (inGroup) {
                                    setGroupFormServices(prev => prev.filter(g => g.service_name !== s.name));
                                  } else {
                                    setGroupFormServices(prev => [...prev, { service_name: s.name, unit_price: parseFloat(s.price) || 0 }]);
                                  }
                                }}
                                className="w-4 h-4 accent-purple-600"
                              />
                              <span className="flex-1">{s.name}</span>
                              <span className="text-xs text-gray-500">₹{parseFloat(s.price || 0).toFixed(0)}</span>
                            </label>
                          );
                        })}
                        {allServices.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-500">No services available. Add services first.</p>
                        )}
                      </div>
                      {/* Blank / custom service row */}
                      <div className="mt-2 grid grid-cols-[1fr_96px_auto] gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Custom service name"
                          className="w-full min-w-0 px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-purple-400"
                          id="grp-blank-name"
                        />
                        <input
                          type="number"
                          placeholder="₹ Price"
                          min="0"
                          className="w-full px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-purple-400"
                          id="grp-blank-price"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nameEl = document.getElementById('grp-blank-name');
                            const priceEl = document.getElementById('grp-blank-price');
                            const name = nameEl?.value?.trim();
                            const price = parseFloat(priceEl?.value) || 0;
                            if (!name) { addToast('Enter service name', 'error'); return; }
                            setGroupFormServices(prev => [...prev, { service_name: name, unit_price: price }]);
                            if (nameEl) nameEl.value = '';
                            if (priceEl) priceEl.value = '';
                          }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 border rounded text-xs hover:bg-slate-200 whitespace-nowrap"
                        >
                          + Add Blank
                        </button>
                      </div>
                    </div>

                    {/* Selected custom/blank services (editable) */}
                    {groupFormServices.filter(g => !allServices.some(s => s.name === g.service_name)).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Custom entries:</p>
                        <div className="space-y-1">
                          {groupFormServices.filter(g => !allServices.some(s => s.name === g.service_name)).map((g, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1 bg-slate-50 border rounded text-xs">
                              <span className="flex-1">{g.service_name}</span>
                              <span className="text-gray-500">₹{parseFloat(g.unit_price || 0).toFixed(0)}</span>
                              <button
                                type="button"
                                onClick={() => setGroupFormServices(prev => prev.filter(x => !(x.service_name === g.service_name && !allServices.some(s => s.name === x.service_name))))}
                                className="text-red-400 hover:text-red-600"
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {groupFormServices.length > 0 && (
                      <p className="text-xs text-purple-700 mb-3">
                        {groupFormServices.length} service(s) selected — Total: ₹{groupFormServices.reduce((sum, s) => sum + (parseFloat(s.unit_price) || 0), 0).toFixed(0)}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!groupFormName.trim()) { addToast('Group name required', 'error'); return; }
                          if (groupFormServices.length === 0) { addToast('Select at least one service', 'error'); return; }
                          try {
                            if (editingGroup) {
                              await api.put(`/api/bills/service-groups/${editingGroup.id}`, { group_name: groupFormName, services: groupFormServices });
                              addToast('Group updated', 'success');
                            } else {
                              await api.post('/api/bills/service-groups', { group_name: groupFormName, services: groupFormServices });
                              addToast('Group created!', 'success');
                            }
                            setShowGroupForm(false); setEditingGroup(null); setGroupFormName(''); setGroupFormServices([]);
                            fetchServiceGroups();
                          } catch (err) { addToast('Failed to save group', 'error'); }
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        {editingGroup ? 'Update' : 'Save Group'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowGroupForm(false); setEditingGroup(null); setGroupFormName(''); setGroupFormServices([]); }}
                        className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Groups List */}
                {serviceGroups.length === 0 && !showGroupForm ? (
                  <div className="text-center py-10 text-gray-500">
                    <div className="text-3xl mb-2">📦</div>
                    <p className="text-sm">No groups yet.</p>
                    <p className="text-xs mt-1">Click "New Group" to bundle services together.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {serviceGroups.map(group => {
                      const svcList = Array.isArray(group.services) ? group.services : [];
                      const total = svcList.reduce((sum, s) => sum + (parseFloat(s.unit_price) || 0), 0);
                      return (
                        <div key={group.id} className="relative border-2 border-purple-200 rounded-lg hover:border-purple-400 transition group">
                          {/* Click to apply */}
                          <button
                            type="button"
                            onClick={() => {
                              // Add all services in group to bill
                              const newItems = svcList.map(s => ({
                                service_name: s.service_name,
                                qty: 1,
                                unit_price: parseFloat(s.unit_price) || 0,
                                discount: 0,
                                total: parseFloat(s.unit_price) || 0
                              }));
                              if (servicePickerTarget === 'edit') {
                                const updatedReceipt = { ...editingReceipt };
                                if (!updatedReceipt.service_items) updatedReceipt.service_items = [];
                                const hasOnlyEmptyRow = updatedReceipt.service_items.length === 1 && !updatedReceipt.service_items[0].service_name && parseFloat(updatedReceipt.service_items[0].unit_price || 0) === 0;
                                updatedReceipt.service_items = hasOnlyEmptyRow ? newItems : [...updatedReceipt.service_items, ...newItems];
                                setEditingReceipt(updatedReceipt);
                              } else {
                                setReceiptForm(prev => {
                                  const hasOnlyEmptyRow = prev.services.length === 1 && !prev.services[0].service_name && parseFloat(prev.services[0].unit_price || 0) === 0;
                                  return { ...prev, services: hasOnlyEmptyRow ? newItems : [...prev.services, ...newItems] };
                                });
                              }
                              addToast(`"${group.group_name}" added (${svcList.length} services)`, 'success');
                              setShowServicePicker(false); setShowGroupForm(false);
                            }}
                            className="w-full text-left p-3"
                          >
                            <div className="font-semibold text-sm text-gray-900 mb-1">{group.group_name}</div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {svcList.slice(0, 4).map((s, i) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{s.service_name}</span>
                              ))}
                              {svcList.length > 4 && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">+{svcList.length - 4} more</span>}
                            </div>
                            <div className="text-xs text-gray-500">{svcList.length} services • <span className="font-medium text-purple-700">₹{total.toFixed(0)}</span></div>
                          </button>
                          {/* Edit / Delete */}
                          <div className="absolute top-1.5 right-1.5 hidden group-hover:flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingGroup(group); setGroupFormName(group.group_name); setGroupFormServices(Array.isArray(group.services) ? [...group.services] : []); setShowGroupForm(true); }}
                              className="p-1 text-gray-400 hover:text-blue-600 bg-white border rounded shadow-sm"
                              title="Edit group"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => { e.stopPropagation(); if (!confirm(`Delete "${group.group_name}"?`)) return; try { await api.delete(`/api/bills/service-groups/${group.id}`); addToast('Group deleted', 'success'); fetchServiceGroups(); } catch { addToast('Failed to delete', 'error'); } }}
                              className="p-1 text-gray-400 hover:text-red-600 bg-white border rounded shadow-sm"
                              title="Delete group"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end p-3 border-t bg-gray-50">
              <button onClick={() => { setShowServicePicker(false); setEditingService(null); setShowAddServiceForm(false); setShowGroupForm(false); }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}