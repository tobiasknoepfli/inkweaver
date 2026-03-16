using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;

namespace InkweaverShell;

public partial class Form1 : Form
{
    private WebView2 webView;

    public Form1()
    {
        InitializeComponent();
        this.Text = "Inkweaver | AI Writer's Suite";
        this.Width = 1400;
        this.Height = 900;
        this.StartPosition = FormStartPosition.CenterScreen;

        // Set Icon
        try {
            string logoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "logo.png");
            if (File.Exists(logoPath)) {
                this.Icon = Icon.FromHandle(new Bitmap(logoPath).GetHicon());
            }
        } catch { }
        
        InitializeAsync();
    }

    async void InitializeAsync()
    {
        webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        this.Controls.Add(webView);

        // Environment for local file access
        var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Path.GetTempPath(), "InkweaverStore"));
        await webView.EnsureCoreWebView2Async(env);

        // Load the index.html from the application directory
        string indexPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "index.html");
        
        if (File.Exists(indexPath))
        {
            webView.CoreWebView2.Navigate(new Uri(indexPath).AbsoluteUri);
        }
        else
        {
            MessageBox.Show("Could not find 'wwwroot/index.html'. Please ensure the web files are in the correct folder.");
        }

        // Add some basic interop or developer tool overrides if needed
        webView.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
        webView.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
    }
}
