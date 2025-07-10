import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronRight, ChevronLeft, Upload, FileText, CreditCard, User, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface SubmissionWizardProps {
  teacher: any;
  token: string;
  onComplete: () => void;
}

interface FormData {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  subject: string;
  class: string;
  board: string;
  examType: string;
  questionPaper: FileList;
  guidelinesAccepted: boolean;
}

const SubmissionWizard: React.FC<SubmissionWizardProps> = ({ teacher, token, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm<FormData>();

  const steps = [
    { id: 1, title: 'Bank Details', icon: CreditCard },
    { id: 2, title: 'Guidelines', icon: FileText },
    { id: 3, title: 'Subject & Paper', icon: Upload },
    { id: 4, title: 'Review & Submit', icon: CheckCircle }
  ];

  const watchedValues = watch();

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = ['accountNumber', 'ifscCode', 'accountHolderName'];
        break;
      case 2:
        fieldsToValidate = ['guidelinesAccepted'];
        break;
      case 3:
        fieldsToValidate = ['subject', 'class', 'board', 'examType', 'questionPaper'];
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('accountNumber', data.accountNumber);
      formData.append('ifscCode', data.ifscCode);
      formData.append('accountHolderName', data.accountHolderName);
      formData.append('subject', data.subject);
      formData.append('class', data.class);
      formData.append('board', data.board);
      formData.append('examType', data.examType);
      formData.append('questionPaper', data.questionPaper[0]);

      await axios.post(`http://localhost:5000/api/submission/submit/${token}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      onComplete();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Bank Account Details</h3>
              <p className="text-gray-600 mb-6">Enter your bank details for payment processing</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Holder Name
                </label>
                <input
                  {...register('accountHolderName', { required: 'Account holder name is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account holder name"
                />
                {errors.accountHolderName && (
                  <p className="text-red-500 text-sm mt-1">{errors.accountHolderName.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number
                </label>
                <input
                  {...register('accountNumber', { required: 'Account number is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account number"
                />
                {errors.accountNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.accountNumber.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IFSC Code
                </label>
                <input
                  {...register('ifscCode', { required: 'IFSC code is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter IFSC code"
                />
                {errors.ifscCode && (
                  <p className="text-red-500 text-sm mt-1">{errors.ifscCode.message}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Submission Guidelines</h3>
              <p className="text-gray-600 mb-6">Please read and accept the following guidelines</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Important Guidelines:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Question papers should be clear and legible</li>
                <li>• File format should be PDF, JPEG, or PNG</li>
                <li>• Maximum file size is 10MB</li>
                <li>• Ensure all questions are properly formatted</li>
                <li>• Include answer keys if required</li>
                <li>• Payment will be processed after approval</li>
                <li>• Submission cannot be modified once submitted</li>
              </ul>
            </div>
            
            <div className="flex items-center">
              <input
                {...register('guidelinesAccepted', { required: 'You must accept the guidelines' })}
                type="checkbox"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-gray-700">
                I have read and accept all the guidelines mentioned above
              </label>
            </div>
            {errors.guidelinesAccepted && (
              <p className="text-red-500 text-sm">{errors.guidelinesAccepted.message}</p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Subject Details & Paper Upload</h3>
              <p className="text-gray-600 mb-6">Provide subject information and upload your question paper</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  {...register('subject', { required: 'Subject is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Mathematics"
                />
                {errors.subject && (
                  <p className="text-red-500 text-sm mt-1">{errors.subject.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class
                </label>
                <select
                  {...register('class', { required: 'Class is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Class</option>
                  {[6, 7, 8, 9, 10, 11, 12].map(cls => (
                    <option key={cls} value={cls}>{cls}th Standard</option>
                  ))}
                </select>
                {errors.class && (
                  <p className="text-red-500 text-sm mt-1">{errors.class.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Board
                </label>
                <select
                  {...register('board', { required: 'Board is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Board</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State Board">State Board</option>
                  <option value="Other">Other</option>
                </select>
                {errors.board && (
                  <p className="text-red-500 text-sm mt-1">{errors.board.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Type
                </label>
                <select
                  {...register('examType', { required: 'Exam type is required' })}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Exam Type</option>
                  <option value="Unit Test">Unit Test</option>
                  <option value="Mid Term">Mid Term</option>
                  <option value="Final Exam">Final Exam</option>
                  <option value="Mock Test">Mock Test</option>
                </select>
                {errors.examType && (
                  <p className="text-red-500 text-sm mt-1">{errors.examType.message}</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Paper Upload
              </label>
              <input
                {...register('questionPaper', { required: 'Question paper is required' })}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: PDF, JPEG, PNG (Max size: 10MB)
              </p>
              {errors.questionPaper && (
                <p className="text-red-500 text-sm mt-1">{errors.questionPaper.message}</p>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Review & Submit</h3>
              <p className="text-gray-600 mb-6">Please review your information before submitting</p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Bank Details</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium">Account Holder:</span> {watchedValues.accountHolderName}</p>
                  <p><span className="font-medium">Account Number:</span> {watchedValues.accountNumber}</p>
                  <p><span className="font-medium">IFSC Code:</span> {watchedValues.ifscCode}</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Subject Information</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium">Subject:</span> {watchedValues.subject}</p>
                  <p><span className="font-medium">Class:</span> {watchedValues.class}th Standard</p>
                  <p><span className="font-medium">Board:</span> {watchedValues.board}</p>
                  <p><span className="font-medium">Exam Type:</span> {watchedValues.examType}</p>
                  <p><span className="font-medium">Question Paper:</span> {watchedValues.questionPaper?.[0]?.name}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Once you submit, you cannot make any changes. 
                Please ensure all information is correct.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg">
      {/* Progress Steps */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isCompleted 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isActive 
                      ? 'bg-blue-500 border-blue-500 text-white' 
                      : 'border-gray-300 text-gray-400'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    Step {step.id}
                  </p>
                  <p className={`text-xs ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-gray-400 mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="px-6 py-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Submit</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default SubmissionWizard;