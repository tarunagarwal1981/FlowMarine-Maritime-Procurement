import axios from 'axios';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { BIConfiguration } from '../biIntegrationService';

export interface TableauDataSource {
  id: string;
  name: string;
  type: string;
  connectionType: string;
  serverAddress: string;
  serverPort: string;
  username: string;
  hasExtracts: boolean;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableauWorkbook {
  id: string;
  name: string;
  description: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
  };
  owner: {
    id: string;
    name: string;
  };
}

export interface TableauProject {
  id: string;
  name: string;
  description: string;
  parentProjectId?: string;
  controllingPermissionsProjectId: string;
}

export class TableauConnector {
  private authToken: string | null = null;
  private siteId: string | null = null;
  private userId: string | null = null;
  private config: BIConfiguration;

  constructor(config: BIConfiguration) {
    this.config = config;
  }

  async authenticate(): Promise<{ token: string; siteId: string; userId: string }> {
    if (this.authToken && this.siteId && this.userId) {
      return {
        token: this.authToken,
        siteId: this.siteId,
        userId: this.userId
      };
    }

    const { serverUrl, username, password, siteName } = this.config.authentication.credentials;

    try {
      const response = await axios.post(
        `${serverUrl}/api/3.9/auth/signin`,
        {
          tsRequest: {
            credentials: {
              name: username,
              password: password,
              site: { contentUrl: siteName }
            }
          }
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const credentials = response.data.tsResponse.credentials;
      this.authToken = credentials.token;
      this.siteId = credentials.site.id;
      this.userId = credentials.user.id;

      logger.info('Tableau authentication successful');
      return {
        token: this.authToken,
        siteId: this.siteId,
        userId: this.userId
      };
    } catch (error) {
      logger.error('Tableau authentication failed:', error);
      throw new AppError('Tableau authentication failed', 401, 'TABLEAU_AUTH_ERROR');
    }
  }

  async signOut(): Promise<void> {
    if (!this.authToken) return;

    const { serverUrl } = this.config.authentication.credentials;

    try {
      await axios.post(
        `${serverUrl}/api/3.9/auth/signout`,
        {},
        {
          headers: {
            'X-Tableau-Auth': this.authToken,
            'Content-Type': 'application/json'
          }
        }
      );

      this.authToken = null;
      this.siteId = null;
      this.userId = null;

      logger.info('Tableau sign out successful');
    } catch (error) {
      logger.error('Tableau sign out failed:', error);
    }
  }

  async createProject(name: string, description?: string, parentProjectId?: string): Promise<TableauProject> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      const response = await axios.post(
        `${serverUrl}/api/3.9/sites/${siteId}/projects`,
        {
          tsRequest: {
            project: {
              name,
              description,
              parentProjectId
            }
          }
        },
        {
          headers: {
            'X-Tableau-Auth': token,
            'Content-Type': 'application/json'
          }
        }
      );

      const project = response.data.tsResponse.project;
      logger.info(`Created Tableau project: ${name}`);
      return project;
    } catch (error) {
      logger.error('Failed to create Tableau project:', error);
      throw new AppError('Failed to create Tableau project', 500, 'TABLEAU_PROJECT_CREATE_ERROR');
    }
  }

  async publishDataSource(
    projectId: string,
    dataSourceFile: Buffer,
    name: string,
    description?: string
  ): Promise<TableauDataSource> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('request_payload', JSON.stringify({
        tsRequest: {
          datasource: {
            name,
            description,
            project: { id: projectId }
          }
        }
      }));
      
      form.append('tableau_datasource', dataSourceFile, {
        filename: `${name}.tds`,
        contentType: 'application/xml'
      });

      const response = await axios.post(
        `${serverUrl}/api/3.9/sites/${siteId}/datasources`,
        form,
        {
          headers: {
            'X-Tableau-Auth': token,
            ...form.getHeaders()
          }
        }
      );

      const dataSource = response.data.tsResponse.datasource;
      logger.info(`Published Tableau data source: ${name}`);
      return dataSource;
    } catch (error) {
      logger.error('Failed to publish Tableau data source:', error);
      throw new AppError('Failed to publish data source', 500, 'TABLEAU_DATASOURCE_PUBLISH_ERROR');
    }
  }

  async updateDataSourceConnection(
    dataSourceId: string,
    connectionDetails: {
      serverAddress: string;
      serverPort: string;
      username: string;
      password: string;
      databaseName: string;
    }
  ): Promise<void> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      await axios.put(
        `${serverUrl}/api/3.9/sites/${siteId}/datasources/${dataSourceId}/connection`,
        {
          tsRequest: {
            connection: {
              serverAddress: connectionDetails.serverAddress,
              serverPort: connectionDetails.serverPort,
              username: connectionDetails.username,
              password: connectionDetails.password,
              databaseName: connectionDetails.databaseName
            }
          }
        },
        {
          headers: {
            'X-Tableau-Auth': token,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Updated Tableau data source connection: ${dataSourceId}`);
    } catch (error) {
      logger.error('Failed to update Tableau data source connection:', error);
      throw new AppError('Failed to update connection', 500, 'TABLEAU_CONNECTION_UPDATE_ERROR');
    }
  }

  async refreshDataSource(dataSourceId: string): Promise<string> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      const response = await axios.post(
        `${serverUrl}/api/3.9/sites/${siteId}/datasources/${dataSourceId}/refresh`,
        {},
        {
          headers: {
            'X-Tableau-Auth': token,
            'Content-Type': 'application/json'
          }
        }
      );

      const jobId = response.data.tsResponse.job.id;
      logger.info(`Started Tableau data source refresh: ${dataSourceId}, Job ID: ${jobId}`);
      return jobId;
    } catch (error) {
      logger.error('Failed to refresh Tableau data source:', error);
      throw new AppError('Failed to refresh data source', 500, 'TABLEAU_REFRESH_ERROR');
    }
  }

  async getRefreshStatus(jobId: string): Promise<any> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      const response = await axios.get(
        `${serverUrl}/api/3.9/sites/${siteId}/jobs/${jobId}`,
        {
          headers: {
            'X-Tableau-Auth': token,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.tsResponse.job;
    } catch (error) {
      logger.error('Failed to get Tableau job status:', error);
      throw new AppError('Failed to get job status', 500, 'TABLEAU_JOB_STATUS_ERROR');
    }
  }

  async getDataSources(): Promise<TableauDataSource[]> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      const response = await axios.get(
        `${serverUrl}/api/3.9/sites/${siteId}/datasources`,
        {
          headers: {
            'X-Tableau-Auth': token,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.tsResponse.datasources.datasource || [];
    } catch (error) {
      logger.error('Failed to get Tableau data sources:', error);
      throw new AppError('Failed to get data sources', 500, 'TABLEAU_DATASOURCES_GET_ERROR');
    }
  }

  async deleteDataSource(dataSourceId: string): Promise<void> {
    const { token, siteId } = await this.authenticate();
    const { serverUrl } = this.config.authentication.credentials;

    try {
      await axios.delete(
        `${serverUrl}/api/3.9/sites/${siteId}/datasources/${dataSourceId}`,
        {
          headers: {
            'X-Tableau-Auth': token,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Deleted Tableau data source: ${dataSourceId}`);
    } catch (error) {
      logger.error('Failed to delete Tableau data source:', error);
      throw new AppError('Failed to delete data source', 500, 'TABLEAU_DATASOURCE_DELETE_ERROR');
    }
  }

  generateWebDataConnector(): string {
    const { serverUrl } = this.config.authentication.credentials;
    const flowMarineApiUrl = process.env.API_BASE_URL || 'http://localhost:3000';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>FlowMarine Maritime Procurement WDC</title>
    <meta http-equiv="Cache-Control" content="no-store" />
    <link href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js" type="text/javascript"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js" crossorigin="anonymous"></script>
    <script src="https://connectors.tableau.com/libs/tableauwdc-2.3.latest.js" type="text/javascript"></script>
</head>
<body>
    <div class="container container-table">
        <div class="row vertical-center-row">
            <div class="text-center col-md-4 col-md-offset-4">
                <button type="button" id="submitButton" class="btn btn-success" style="margin: 10px;">Get FlowMarine Data!</button>
            </div>
        </div>
    </div>

    <script type="text/javascript">
        (function() {
            var myConnector = tableau.makeConnector();

            myConnector.getSchema = function(schemaCallback) {
                var cols = [
                    { id: "vessel_id", alias: "Vessel ID", dataType: tableau.dataTypeEnum.string },
                    { id: "vessel_name", alias: "Vessel Name", dataType: tableau.dataTypeEnum.string },
                    { id: "category", alias: "Category", dataType: tableau.dataTypeEnum.string },
                    { id: "amount", alias: "Amount", dataType: tableau.dataTypeEnum.float },
                    { id: "currency", alias: "Currency", dataType: tableau.dataTypeEnum.string },
                    { id: "date", alias: "Date", dataType: tableau.dataTypeEnum.datetime },
                    { id: "vendor_name", alias: "Vendor Name", dataType: tableau.dataTypeEnum.string },
                    { id: "delivery_score", alias: "Delivery Score", dataType: tableau.dataTypeEnum.float },
                    { id: "quality_score", alias: "Quality Score", dataType: tableau.dataTypeEnum.float }
                ];

                var tableSchema = {
                    id: "flowmarine_analytics",
                    alias: "FlowMarine Maritime Procurement Analytics",
                    columns: cols
                };

                schemaCallback([tableSchema]);
            };

            myConnector.getData = function(table, doneCallback) {
                $.getJSON("${flowMarineApiUrl}/api/external-analytics/tableau-data", function(resp) {
                    var feat = resp.data,
                        tableData = [];

                    for (var i = 0, len = feat.length; i < len; i++) {
                        tableData.push({
                            "vessel_id": feat[i].vesselId,
                            "vessel_name": feat[i].vesselName,
                            "category": feat[i].category,
                            "amount": feat[i].amount,
                            "currency": feat[i].currency,
                            "date": feat[i].date,
                            "vendor_name": feat[i].vendorName,
                            "delivery_score": feat[i].deliveryScore,
                            "quality_score": feat[i].qualityScore
                        });
                    }

                    table.appendRows(tableData);
                    doneCallback();
                });
            };

            tableau.registerConnector(myConnector);

            $(document).ready(function() {
                $("#submitButton").click(function() {
                    tableau.connectionName = "FlowMarine Maritime Procurement Data";
                    tableau.submit();
                });
            });
        })();
    </script>
</body>
</html>`;
  }

  async setupFlowMarineDataSource(): Promise<TableauDataSource> {
    // Create TDS (Tableau Data Source) file content
    const tdsContent = `<?xml version='1.0' encoding='utf-8' ?>
<datasource formatted-name='FlowMarine Maritime Procurement' inline='true' source-platform='win' version='18.1' xmlns:user='http://www.tableausoftware.com/xml/user'>
  <document-format-change-manifest>
    <_.fcp.ObjectModelEncapsulateLegacy.true...ObjectModelEncapsulateLegacy>
    <_.fcp.ObjectModelTableType.true...ObjectModelTableType>
    <_.fcp.SchemaViewerObjectModel.true...SchemaViewerObjectModel>
  </document-format-change-manifest>
  <connection class='postgres' dbname='${process.env.DB_NAME}' odbc-native-protocol='' one-time-sql='' port='${process.env.DB_PORT}' server='${process.env.DB_HOST}' username='${process.env.BI_DB_USER}'>
    <relation connection='postgres' name='bi_fleet_spend_analytics' table='[public].[bi_fleet_spend_analytics]' type='table'>
      <columns>
        <column datatype='string' name='vessel_id' role='dimension' type='nominal' />
        <column datatype='string' name='vessel_name' role='dimension' type='nominal' />
        <column datatype='string' name='category' role='dimension' type='nominal' />
        <column datatype='real' name='amount' role='measure' type='quantitative' />
        <column datatype='string' name='currency' role='dimension' type='nominal' />
        <column datatype='datetime' name='date' role='dimension' type='ordinal' />
        <column datatype='string' name='vendor_name' role='dimension' type='nominal' />
      </columns>
    </relation>
    <metadata-records>
      <metadata-record class='column'>
        <remote-name>vessel_id</remote-name>
        <remote-type>129</remote-type>
        <local-name>[vessel_id]</local-name>
        <parent-name>[bi_fleet_spend_analytics]</parent-name>
        <remote-alias>vessel_id</remote-alias>
        <ordinal>1</ordinal>
        <local-type>string</local-type>
        <aggregation>Count</aggregation>
        <contains-null>true</contains-null>
      </metadata-record>
    </metadata-records>
  </connection>
  <aliases enabled='yes' />
  <column datatype='integer' name='[Number of Records]' role='measure' type='quantitative' user:auto-column='numrec'>
    <calculation class='tableau' formula='1' />
  </column>
  <layout _.fcp.SchemaViewerObjectModel.false...dim-percentage='0.5' _.fcp.SchemaViewerObjectModel.false...measure-percentage='0.4' dim-ordering='alphabetic' measure-ordering='alphabetic' show-structure='true' />
  <semantic-values>
    <semantic-value key='[Country].[Name]' value='&quot;United States&quot;' />
  </semantic-values>
</datasource>`;

    const projectId = this.config.configuration.projectId;
    const tdsBuffer = Buffer.from(tdsContent, 'utf-8');

    return await this.publishDataSource(
      projectId,
      tdsBuffer,
      'FlowMarine Maritime Procurement Analytics',
      'Real-time maritime procurement data from FlowMarine platform'
    );
  }
}