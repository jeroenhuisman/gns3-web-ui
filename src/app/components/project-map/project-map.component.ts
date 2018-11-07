import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, EventEmitter } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';

import { Observable, Subject, Subscription, from } from 'rxjs';
import { webSocket } from "rxjs/webSocket";
import { map, mergeMap } from "rxjs/operators";

import { Project } from '../../models/project';
import { Node } from '../../cartography/models/node';
import { SymbolService } from '../../services/symbol.service';
import { Link } from "../../models/link";
import { MapComponent } from "../../cartography/components/map/map.component";
import { ServerService } from "../../services/server.service";
import { ProjectService } from '../../services/project.service';
import { Server } from "../../models/server";
import { Drawing } from "../../cartography/models/drawing";
import { Appliance } from "../../models/appliance";
import { NodeService } from "../../services/node.service";
import { Symbol } from "../../models/symbol";
import { LinkService } from "../../services/link.service";
import { NodesDataSource } from "../../cartography/datasources/nodes-datasource";
import { LinksDataSource } from "../../cartography/datasources/links-datasource";
import { ProjectWebServiceHandler } from "../../handlers/project-web-service-handler";
import { SelectionManager } from "../../cartography/managers/selection-manager";
import { InRectangleHelper } from "../../cartography/helpers/in-rectangle-helper";
import { DrawingsDataSource } from "../../cartography/datasources/drawings-datasource";
import { ProgressService } from "../../common/progress/progress.service";
import { LinkCreated } from '../../cartography/events/links';
import { NodeDragged } from '../../cartography/events/nodes';


@Component({
  selector: 'app-project-map',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './project-map.component.html',
  styleUrls: ['./project-map.component.css'],
})
export class ProjectMapComponent implements OnInit, OnDestroy {
  public nodes: Node[] = [];
  public links: Link[] = [];
  public drawings: Drawing[] = [];
  public symbols: Symbol[] = [];
  public changed = new EventEmitter<any>();
  public nodeUpdated = new EventEmitter<Node>();

  project: Project;
  public server: Server;
  private ws: Subject<any>;

  protected tools = {
    'selection': true,
    'moving': false,
    'draw_link': false
  };

  private inReadOnlyMode = false;


  @ViewChild(MapComponent) mapChild: MapComponent;

  private subscriptions: Subscription[] = [];

  constructor(
              private route: ActivatedRoute,
              private serverService: ServerService,
              private projectService: ProjectService,
              private symbolService: SymbolService,
              private nodeService: NodeService,
              private linkService: LinkService,
              private progressService: ProgressService,
              private projectWebServiceHandler: ProjectWebServiceHandler,
              private selectionManager: SelectionManager,
              protected nodesDataSource: NodesDataSource,
              protected linksDataSource: LinksDataSource,
              protected drawingsDataSource: DrawingsDataSource,
              ){}

  ngOnInit() {
    this.progressService.activate();

    const routeSub = this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const server_id = parseInt(paramMap.get('server_id'), 10);

      from(this.serverService.get(server_id)).pipe(
        mergeMap((server: Server) => {
          this.server = server;
          return this.projectService.get(server, paramMap.get('project_id')).pipe(map((project) => {
            return project;
          }));
        }),
        mergeMap((project: Project) => {
          this.project = project;

          if (this.project.status === 'opened') {
            return new Observable<Project>((observer) => {
              observer.next(this.project);
            });
          } else {
            return this.projectService.open(
              this.server, this.project.project_id);
          }
        })
      )
      .subscribe((project: Project) => {
        this.onProjectLoad(project);
      }, (error) => {
        this.progressService.setError(error);
      }, () => {
          this.progressService.deactivate();
      });
    });

    this.subscriptions.push(routeSub);

    this.subscriptions.push(
      this.symbolService.symbols.subscribe((symbols: Symbol[]) => {
        this.symbols = symbols;
      })
    );

    this.subscriptions.push(
      this.drawingsDataSource.changes.subscribe((drawings: Drawing[]) => {
        this.drawings = drawings;
        this.changed.emit();
      })
    );

    this.subscriptions.push(
      this.nodesDataSource.changes.subscribe((nodes: Node[]) => {
        this.nodes = nodes;
        this.changed.emit();
      })
    );

    this.subscriptions.push(
      this.nodesDataSource.itemChanged.subscribe((node: Node) => {
        this.nodeUpdated.emit(node);
      })
    );

    this.subscriptions.push(
      this.linksDataSource.changes.subscribe((links: Link[]) => {
        this.links = links;
        this.changed.emit();
      })
    );
  }

  onProjectLoad(project: Project) {
    this.readonly = this.projectService.isReadOnly(project);

    const subscription = this.symbolService
      .load(this.server)
      .pipe(
        mergeMap(() => {
          return this.projectService.nodes(this.server, project.project_id);
        }),
        mergeMap((nodes: Node[]) => {
          this.nodesDataSource.set(nodes);
          return this.projectService.links(this.server, project.project_id);
        }),
        mergeMap((links: Link[]) => {
          this.linksDataSource.set(links);
          return this.projectService.drawings(this.server, project.project_id);
        })
      )
      .subscribe((drawings: Drawing[]) => {
        this.drawingsDataSource.set(drawings);

        this.setUpMapCallbacks(project);
        this.setUpWS(project);

        this.progressService.deactivate();
      });
    this.subscriptions.push(subscription);
  }

  setUpWS(project: Project) {
    this.ws = webSocket(
      this.projectService.notificationsPath(this.server, project.project_id));

    this.subscriptions.push(
      this.projectWebServiceHandler.connect(this.ws)
    );
  }

  setUpMapCallbacks(project: Project) {
    // if (this.readonly) {
    //     this.mapChild.graphLayout.getSelectionTool().deactivate();
    // }

    // this.mapChild.graphLayout.getNodesWidget().setDraggingEnabled(!this.readonly);

    // this.mapChild.graphLayout.getNodesWidget().setOnContextMenuCallback((event: any, node: Node) => {
    //   this.nodeContextMenu.open(node, event.clientY, event.clientX);
    // });

    // this.mapChild.graphLayout.getNodesWidget().setOnNodeClickedCallback((event: any, node: Node) => {
    //   this.selectionManager.clearSelection();
    //   this.selectionManager.setSelectedNodes([node]);
    //   if (this.drawLineMode) {
    //     this.nodeSelectInterfaceMenu.open(node, event.clientY, event.clientX);
    //   }
    // });

    // this.mapChild.graphLayout.getNodesWidget().setOnNodeDraggedCallback((event: any, node: Node) => {
    //   this.nodesDataSource.update(node);
    //   this.nodeService
    //     .updatePosition(this.server, node, node.x, node.y)
    //     .subscribe((n: Node) => {
    //       this.nodesDataSource.update(n);
    //     });
    // });

    // this.subscriptions.push(
    //   this.selectionManager.subscribe(
    //     this.mapChild.graphLayout.getSelectionTool().rectangleSelected)
    // );

    // this.mapChild.graphLayout
    //   .getLinksWidget().getLinkWidget().getInterfaceLabelWidget().setEnabled(this.project.show_interface_labels);

    // this.mapChild.reload();
  }

  onNodeCreation(appliance: Appliance) {
    this.nodeService
      .createFromAppliance(this.server, this.project, appliance, 0, 0, 'local')
      .subscribe(() => {
        this.projectService
          .nodes(this.server, this.project.project_id)
          .subscribe((nodes: Node[]) => {
            this.nodesDataSource.set(nodes);
        });
      });
  }

  onNodeDragged(nodeEvent: NodeDragged) {
    this.nodesDataSource.update(nodeEvent.node);
    this.nodeService
      .updatePosition(this.server, nodeEvent.node, nodeEvent.node.x, nodeEvent.node.y)
      .subscribe((n: Node) => {
        this.nodesDataSource.update(n);
      });
  }

  public set readonly(value) {
    this.inReadOnlyMode = value;
    if (value) {
      this.tools.selection = false;
    }
    else {
      this.tools.selection = true;
    }
  }

  public get readonly() {
    return this.inReadOnlyMode;
  }

  public toggleMovingMode() {
    this.tools.moving = !this.tools.moving;
    if (!this.readonly) {
      this.tools.selection = !this.tools.moving;
    }
  }

  public toggleDrawLineMode() {
    this.tools.draw_link = !this.tools.draw_link;
  }

  public onLinkCreated(linkCreated: LinkCreated) {
    this.linkService
      .createLink(this.server, linkCreated.sourceNode, linkCreated.sourcePort, linkCreated.targetNode, linkCreated.targetPort)
      .subscribe(() => {
        this.projectService.links(this.server, this.project.project_id).subscribe((links: Link[]) => {
          this.linksDataSource.set(links);
        });
      });
  }

  public toggleShowInterfaceLabels(enabled: boolean) {
    this.project.show_interface_labels = enabled;
  }

  public ngOnDestroy() {
    this.drawingsDataSource.clear();
    this.nodesDataSource.clear();
    this.linksDataSource.clear();

    if (this.ws) {
      this.ws.unsubscribe();
    }
    this.subscriptions.forEach((subscription: Subscription) => subscription.unsubscribe());
  }

}
