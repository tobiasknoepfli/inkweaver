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

        // Initialize WebView2 early to avoid CS8618
        webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        this.Controls.Add(webView);

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

        // Add Interop Bridge
        webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string message = e.TryGetWebMessageAsString();
        if (string.IsNullOrEmpty(message)) return;

        try {
            if (message == "select_file") {
                using (OpenFileDialog openFileDialog = new OpenFileDialog()) {
                    openFileDialog.Filter = "Inkweaver Projects (*.ink)|*.ink|JSON Files (*.json)|*.json|All files (*.*)|*.*";
                    openFileDialog.FilterIndex = 1;
                    openFileDialog.RestoreDirectory = true;

                    if (openFileDialog.ShowDialog() == DialogResult.OK) {
                        string filePath = openFileDialog.FileName;
                        string content = File.ReadAllText(filePath);
                        // Send back to JS: { "type": "file_loaded", "path": "...", "content": "..." }
                        webView.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(new { 
                            type = "file_selected", 
                            path = filePath, 
                            data = content 
                        }));
                    }
                }
            }
            else if (message.StartsWith("save_file|")) {
                var parts = message.Split('|', 3);
                if (parts.Length == 3) {
                    string path = parts[1];
                    string content = parts[2];
                    File.WriteAllText(path, content);
                    webView.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(new { 
                        type = "file_saved", 
                        path = path 
                    }));
                }
            }
            else if (message == "new_project") {
                using (SaveFileDialog saveFileDialog = new SaveFileDialog()) {
                    saveFileDialog.Filter = "Inkweaver Projects (*.ink)|*.ink";
                    saveFileDialog.DefaultExt = "ink";
                    if (saveFileDialog.ShowDialog() == DialogResult.OK) {
                        webView.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(new { 
                            type = "project_created", 
                            path = saveFileDialog.FileName 
                        }));
                    }
                }
            }
        } catch (Exception ex) {
            MessageBox.Show("Native Bridge Error: " + ex.Message);
        }
    }
}
