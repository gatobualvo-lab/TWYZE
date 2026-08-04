/*
  # Add Email Templates

  1. New Tables
    - `email_templates` - Stores email templates for various notification types
  
  2. Security
    - Enable RLS on the table
    - Add policies for users to view active templates
    - Add policies for admins to manage templates
    
  3. Default Templates
    - Sale confirmation email
    - Payment confirmation email
    - Weekly summary email
    - Test email template
*/

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for email_templates
CREATE POLICY "Users can view active email templates"
  ON email_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default email templates
DO $$
BEGIN
  -- Sale Confirmation Template
  INSERT INTO email_templates (name, subject, html_content, type, is_active)
  VALUES (
    'Sale Confirmation',
    'Sale Recorded: {{productName}}',
    E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #1e40af; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Sale Recorded</h1></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>A new sale has been successfully recorded in your Trackwyze account:</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #1e40af;"><p><strong>Product:</strong> {{productName}}</p><p><strong>Amount:</strong> KES {{amount}}</p><p><strong>Profit:</strong> KES {{profit}}</p><p><strong>Date:</strong> {{date}}</p></div><p>You can view the complete details of this sale in your Trackwyze dashboard.</p><div style="text-align: center; margin-top: 30px;"><a href="https://trackwyze.com" style="background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></div><p style="margin-top: 30px;">Thank you for using Trackwyze to track your business success!</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
    'sale_confirmation',
    true
  );

  -- Payment Confirmation Template
  INSERT INTO email_templates (name, subject, html_content, type, is_active)
  VALUES (
    'Payment Confirmation',
    'Payment to {{supplierName}} Recorded',
    E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #15803d; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Payment Recorded</h1></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>A payment to supplier has been successfully recorded in your Trackwyze account:</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #15803d;"><p><strong>Supplier:</strong> {{supplierName}}</p><p><strong>Product:</strong> {{productName}}</p><p><strong>Amount Paid:</strong> KES {{amount}}</p><p><strong>Date:</strong> {{date}}</p></div><p>You can view the complete details of this payment in your Trackwyze dashboard.</p><div style="text-align: center; margin-top: 30px;"><a href="https://trackwyze.com" style="background-color: #15803d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></div><p style="margin-top: 30px;">Thank you for using Trackwyze to track your business success!</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
    'payment_confirmation',
    true
  );

  -- Weekly Summary Template
  INSERT INTO email_templates (name, subject, html_content, type, is_active)
  VALUES (
    'Weekly Summary',
    'Your Weekly Business Summary',
    E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #4f46e5; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Weekly Business Summary</h1><p style="margin-top: 5px;">{{startDate}} - {{endDate}}</p></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>Here is your weekly business summary from Trackwyze:</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4f46e5;"><h3 style="margin-top: 0;">Sales Summary</h3><p><strong>Total Sales:</strong> {{totalSales}}</p><p><strong>Total Revenue:</strong> KES {{totalRevenue}}</p><p><strong>Total Profit:</strong> KES {{totalProfit}}</p></div><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4f46e5;"><h3 style="margin-top: 0;">Expenses Summary</h3><p><strong>Ad Expenses:</strong> KES {{adExpenses}}</p><p><strong>General Expenses:</strong> KES {{generalExpenses}}</p><p><strong>Total Expenses:</strong> KES {{totalExpenses}}</p></div><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #4f46e5;"><h3 style="margin-top: 0;">Net Profit</h3><p><strong>Net Profit:</strong> KES {{netProfit}}</p></div><div style="text-align: center; margin-top: 30px;"><a href="https://trackwyze.com" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Full Report</a></div><p style="margin-top: 30px;">Thank you for using Trackwyze to track your business success!</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
    'weekly_summary',
    true
  );

  -- Test Email Template
  INSERT INTO email_templates (name, subject, html_content, type, is_active)
  VALUES (
    'Test Email',
    'TrackWyze Email System Test',
    E'<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;"><div style="background-color: #1e40af; padding: 20px; text-align: center; color: white;"><h1 style="margin: 0;">Email System Test</h1></div><div style="padding: 20px; border: 1px solid #ddd; border-top: none;"><p>Hello {{userName}},</p><p>This is a test email from your TrackWyze application.</p><p>If you\'re receiving this email, it means your email notification system is working correctly!</p><div style="background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #1e40af;"><p><strong>Email:</strong> {{userEmail}}</p><p><strong>Time:</strong> {{timestamp}}</p></div><p>You can now configure your application to send automated emails for sales and supplier payments.</p><p>Best regards,<br>The Trackwyze Team</p></div><div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;"><p>© 2025 Trackwyze. All rights reserved.</p><p>If you have any questions, please contact our support team at support@trackwyze.com</p></div></body></html>',
    'test',
    true
  );
END $$;

-- Create a function to get email template by type
CREATE OR REPLACE FUNCTION get_email_template(template_type TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  subject TEXT,
  html_content TEXT,
  type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    et.id,
    et.name,
    et.subject,
    et.html_content,
    et.type
  FROM 
    email_templates et
  WHERE 
    et.type = template_type
    AND et.is_active = true
  ORDER BY 
    et.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;