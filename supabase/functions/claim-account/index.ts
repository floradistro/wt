/**
 * Claim Account Edge Function
 *
 * Allows existing customers (from POS) to claim their account on the web store.
 * Looks up by email or phone, creates auth user, links to customer, sends password reset.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClaimAccountRequest {
  email?: string
  phone?: string
  vendorId?: string
  redirectTo?: string // URL for password reset redirect
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const body: ClaimAccountRequest = await req.json()
    const { email, phone, vendorId, redirectTo } = body

    console.log('📱 Claim account request:', { email, phone: phone ? '***' + phone.slice(-4) : null, vendorId })

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: 'Email or phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize inputs
    const normalizedEmail = email?.toLowerCase().trim()
    const normalizedPhone = phone?.replace(/\D/g, '') // Remove non-digits

    // Build query to find customer
    let query = supabaseAdmin
      .from('customers')
      .select('id, email, phone, first_name, last_name, loyalty_points, auth_user_id, vendor_id')
      .eq('is_active', true)

    // Add vendor filter if provided
    if (vendorId) {
      query = query.eq('vendor_id', vendorId)
    }

    // Search by phone first (if provided), then by email
    // This handles the case where a phone-only customer is providing a new email
    if (normalizedPhone) {
      query = query.eq('phone', normalizedPhone)
    } else if (normalizedEmail) {
      query = query.eq('email', normalizedEmail)
    }

    const { data: customer, error: customerError } = await query.single()

    if (customerError || !customer) {
      console.log('❌ Customer not found')
      return new Response(
        JSON.stringify({ error: 'No account found with that information. Please check and try again.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Found customer:', customer.id, 'Points:', customer.loyalty_points)

    // Check if customer only has phone (no email or fake/placeholder email)
    const hasRealEmail = customer.email &&
      !customer.email.includes('@walk-in.local') &&
      !customer.email.includes('@deleted.local') &&
      !customer.email.includes('@alpine.local') &&
      !customer.email.endsWith('.local')

    // If searching by phone and customer has no real email, they need to provide one
    if (normalizedPhone && !normalizedEmail && !hasRealEmail) {
      console.log('📧 Customer needs to provide email')
      return new Response(
        JSON.stringify({
          needsEmail: true,
          customerInfo: {
            firstName: customer.first_name,
            loyaltyPoints: customer.loyalty_points || 0,
          },
          message: 'Please provide an email address to complete account setup.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine the email to use for auth
    const authEmail = normalizedEmail || customer.email

    if (!authEmail || authEmail.endsWith('.local')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required to claim your account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if customer already has an auth account linked
    if (customer.auth_user_id) {
      console.log('🔗 Customer already has auth account, sending password reset')

      // If customer is providing a new email (they had phone-only before), update it
      if (normalizedEmail && customer.email !== normalizedEmail) {
        console.log('📧 Updating customer email from', customer.email, 'to', normalizedEmail)

        // Update auth user email
        await supabaseAdmin.auth.admin.updateUserById(customer.auth_user_id, {
          email: normalizedEmail,
          email_confirm: true,
        })

        // Update customer record email
        await supabaseAdmin
          .from('customers')
          .update({ email: normalizedEmail })
          .eq('id', customer.id)
      }

      // Just send a password reset email
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(authEmail, {
        redirectTo: redirectTo || undefined,
      })

      if (resetError) {
        console.error('❌ Password reset error:', resetError)
        throw new Error('Failed to send password reset email')
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `We sent a password reset link to ${authEmail}. Check your email to set your password.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new auth user for this customer
    console.log('🆕 Creating auth user for customer')

    let authUserId: string

    // Try to create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      email_confirm: true, // Auto-confirm since they're an existing customer
      user_metadata: {
        first_name: customer.first_name,
        last_name: customer.last_name,
      },
    })

    if (authError) {
      // If user already exists in auth, find them
      if (authError.message.includes('already been registered') ||
          authError.message.includes('User already registered')) {
        console.log('🔍 Auth user exists, looking up...')

        // Search for existing auth user by email
        let page = 0
        const perPage = 100
        let foundUser = null

        while (!foundUser && page < 10) {
          const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          })

          foundUser = usersPage?.users?.find(u => u.email?.toLowerCase() === authEmail.toLowerCase())

          if (!foundUser && (!usersPage?.users || usersPage.users.length < perPage)) {
            break
          }
          page++
        }

        if (!foundUser) {
          throw new Error('Account exists but could not be located. Please contact support.')
        }

        authUserId = foundUser.id
      } else {
        throw new Error('Failed to create account: ' + authError.message)
      }
    } else {
      authUserId = authData.user.id
    }

    // Link auth user to customer record
    console.log('🔗 Linking auth user to customer')

    const updateData: Record<string, any> = { auth_user_id: authUserId }

    // If we got a new email (phone-only customer providing email), update it
    if (normalizedEmail && customer.email !== normalizedEmail) {
      updateData.email = normalizedEmail
    }

    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update(updateData)
      .eq('id', customer.id)

    if (updateError) {
      console.error('❌ Failed to link customer:', updateError)
      throw new Error('Failed to link account')
    }

    // Send password reset email so user can set their password
    console.log('📧 Sending password reset email')

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(authEmail, {
      redirectTo: redirectTo || undefined,
    })

    if (resetError) {
      console.error('❌ Password reset error:', resetError)
      // Don't fail - account was created successfully
    }

    console.log('✅ Account claimed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: `Success! We sent a link to ${authEmail}. Click it to set your password and access your ${customer.loyalty_points || 0} loyalty points.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Claim account error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
