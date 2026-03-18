using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using Microsoft.Data.Sqlite;

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
        try {
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
        } catch (Exception ex) {
            MessageBox.Show("Initialization Error: " + ex.Message);
        }
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string message = e.TryGetWebMessageAsString();
        if (string.IsNullOrEmpty(message)) return;

        try {
            if (message.StartsWith("list_dir|")) {
                var path = message.Split('|')[1];
                
                try {
                    if (path == "DRIVES") {
                        var drives = DriveInfo.GetDrives().Where(d => d.IsReady).Select(d => new {
                            name = d.Name,
                            path = d.Name,
                            isDir = true
                        });
                        webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                            type = "directory_list", 
                            path = "My Computer", 
                            entries = drives 
                        }));
                    } else {
                        if (string.IsNullOrEmpty(path)) path = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                        
                        var entries = Directory.GetFileSystemEntries(path).Select(e => new {
                            name = Path.GetFileName(e),
                            path = e,
                            isDir = Directory.Exists(e)
                        });

                        webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                            type = "directory_list", 
                            path = path, 
                            entries = entries 
                        }));
                    }
                } catch (Exception ex) {
                    webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                        type = "directory_error", 
                        message = ex.Message 
                    }));
                }
            }
            else if (message == "get_user_home") {
                webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                    type = "user_home", 
                    path = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)
                }));
            }
            else if (message.StartsWith("read_file|")) {
                var parts = message.Split('|');
                var path = parts[1];
                var type = parts.Length > 2 ? parts[2] : "file_selected"; // db or project

                if (File.Exists(path)) {
                    string content = "";
                    if (path.EndsWith(".db")) {
                        EnsureDatabaseSchema(path);
                        content = LoadFromSqlite(path);
                    } else {
                        content = File.ReadAllText(path);
                    }

                    webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                        type = type == "db" ? "db_selected" : "file_selected", 
                        path = path, 
                        data = content 
                    }));
                }
            }
            else if (message.StartsWith("save_file|")) {
                var parts = message.Split('|', 3);
                if (parts.Length == 3) {
                    string path = parts[1];
                    string content = parts[2];
                    File.WriteAllText(path, content);
                    webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                        type = "file_saved", 
                        path = path 
                    }));
                }
            }
            else if (message.StartsWith("save_sqlite|")) {
                var parts = message.Split('|', 3);
                if (parts.Length == 3) {
                    string path = parts[1];
                    string content = parts[2];
                    SaveToSqlite(path, content);
                    webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                        type = "db_saved", 
                        path = path 
                    }));
                }
            }
            else if (message == "new_project") {
                using (SaveFileDialog saveFileDialog = new SaveFileDialog()) {
                    saveFileDialog.Filter = "Inkweaver Projects (*.ink)|*.ink";
                    saveFileDialog.DefaultExt = "ink";
                    if (saveFileDialog.ShowDialog() == DialogResult.OK) {
                        webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { 
                            type = "project_created", 
                            path = saveFileDialog.FileName 
                        }));
                    }
                }
            }
        } catch (Exception ex) {
            Debug.WriteLine("Native Bridge Error: " + ex.ToString());
            MessageBox.Show("Bridge Error: " + ex.Message);
        }
    }

    private void EnsureDatabaseSchema(string path)
    {
        using (var connection = new SqliteConnection($"Data Source={path};Pooling=False"))
        {
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = "CREATE TABLE IF NOT EXISTS ProjectState (Id INTEGER PRIMARY KEY, Data TEXT, LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP)";
            command.ExecuteNonQuery();
        }
    }

    private void SaveToSqlite(string path, string json)
    {
        EnsureDatabaseSchema(path);
        using (var connection = new SqliteConnection($"Data Source={path};Pooling=False"))
        {
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = "INSERT OR REPLACE INTO ProjectState (Id, Data, LastUpdated) VALUES (1, $data, CURRENT_TIMESTAMP)";
            command.Parameters.AddWithValue("$data", json);
            command.ExecuteNonQuery();
        }
    }

    private string LoadFromSqlite(string path)
    {
        EnsureDatabaseSchema(path);
        using (var connection = new SqliteConnection($"Data Source={path};Pooling=False"))
        {
            connection.Open();
            var command = connection.CreateCommand();
            command.CommandText = "SELECT Data FROM ProjectState WHERE Id = 1";
            using (var reader = command.ExecuteReader())
            {
                if (reader.Read())
                {
                    return reader.GetString(0);
                }
            }
        }
        return "";
    }
}
