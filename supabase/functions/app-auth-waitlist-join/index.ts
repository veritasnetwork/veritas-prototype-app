import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@latest';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email } = await req.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const { data: existingEntry } = await supabaseClient
      .from('waitlist')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    // If email exists, return success without sending duplicate email
    if (existingEntry) {
      // Get position for returning to user
      const { count } = await supabaseClient
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
        .lte('created_at', new Date().toISOString());

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Already on waitlist',
          position: count || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert into waitlist
    const { error: insertError } = await supabaseClient
      .from('waitlist')
      .insert({
        email: normalizedEmail,
        status: 'pending'
      });

    if (insertError) {
      throw insertError;
    }

    // Get queue position
    const { count: position } = await supabaseClient
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    // Send confirmation email via Resend (if API key is configured)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: 'Veritas Protocol <onboarding@resend.dev>',
          to: normalizedEmail,
          subject: `You're #${position} on the Veritas Waitlist! 🎯`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  .header {
                    background: linear-gradient(135deg, #0C1D51 0%, #B9D9EB 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                  }
                  .position {
                    font-size: 48px;
                    font-weight: bold;
                    color: #0C1D51;
                    text-align: center;
                    margin: 30px 0;
                  }
                  .content {
                    background: #f8f9fa;
                    padding: 25px;
                    border-radius: 10px;
                    margin: 20px 0;
                  }
                  .cta {
                    text-align: center;
                    margin: 30px 0;
                  }
                  .button {
                    display: inline-block;
                    padding: 12px 30px;
                    background: #0C1D51;
                    color: white !important;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: 600;
                  }
                  .footer {
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e0e0e0;
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">Welcome to Veritas Protocol</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">Discover what humanity truly believes</p>
                </div>

                <div class="position">
                  You're #${position}
                </div>

                <div class="content">
                  <p><strong>Thank you for joining the Veritas waitlist!</strong></p>
                  <p>We're building a revolutionary Bayesian Truth Serum protocol that reveals collective beliefs while rewarding honest participation.</p>
                  <p>As we prepare for our alpha launch, you'll be among the first to experience:</p>
                  <ul>
                    <li>Connect your Solana wallet and deposit stake to participate in belief markets</li>
                    <li>Early access to shape the platform's direction</li>
                    <li>Exclusive invite codes to share with your network</li>
                  </ul>
                </div>

                <div class="cta">
                  <p><strong>Help us grow the community:</strong></p>
                  <a href="https://twitter.com/intent/tweet?text=I%20just%20joined%20the%20%40VeritasProtocol%20waitlist!%20%23${position}%20in%20line%20for%20early%20access.%20Join%20me%3A%20https%3A%2F%2Fveritas.fyi" class="button">
                    Share on Twitter
                  </a>
                </div>

                <div class="footer">
                  <p>You're receiving this because you joined the Veritas Protocol waitlist.</p>
                  <p>© 2024 Veritas Protocol. All rights reserved.</p>
                </div>
              </body>
            </html>
          `
        });
      } catch (emailError) {
        // Log error but don't fail the request
        console.error('Email send error:', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully joined waitlist',
        position: position || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Waitlist join error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});